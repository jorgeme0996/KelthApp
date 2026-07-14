import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "../prisma";
import { TARGET_FILTERED_BODY_PARTS } from "./routineGenerator";
import { buildPersonalizationSummary } from "./chatContext";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ROUNDTRIPS = 4;

export type ExerciseSwapMode = "equipment_unavailable" | "technique_help";

export const exerciseDraftSchema = z.object({
  name: z.string().min(1).max(120),
  equipment: z.string().min(1),
  instructions: z.string().min(1),
  instructionSteps: z.array(z.string().min(1)).min(1),
  muscleGroup: z.string().min(1),
  secondaryMuscles: z.array(z.string()).default([]),
  target: z.string().min(1),
});

export type ExerciseDraft = z.infer<typeof exerciseDraftSchema>;

export const exerciseOptionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), exerciseId: z.string().min(1) }),
  z.object({ kind: z.literal("ai_generated"), draft: exerciseDraftSchema }),
]);

export type ExerciseOption = z.infer<typeof exerciseOptionSchema>;

export const proposeExerciseOptionsInputSchema = z.object({
  options: z.array(exerciseOptionSchema).length(3),
});

const EXERCISE_DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    equipment: { type: "string" },
    instructions: { type: "string" },
    instructionSteps: { type: "array", items: { type: "string" } },
    muscleGroup: { type: "string" },
    secondaryMuscles: { type: "array", items: { type: "string" } },
    target: { type: "string" },
  },
  required: ["name", "equipment", "instructions", "instructionSteps", "muscleGroup", "target"],
};

export const EXERCISE_OPTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["catalog", "ai_generated"] },
    exerciseId: { type: "string" },
    draft: EXERCISE_DRAFT_JSON_SCHEMA,
  },
  required: ["kind"],
};

export const searchExerciseCatalogTool: Anthropic.Tool = {
  name: "search_exercise_catalog",
  description:
    "Busca ejercicios reales en el catálogo de la app por parte del cuerpo, músculo objetivo, equipo disponible y/o palabra clave. Úsala SIEMPRE antes de proponer opciones, para preferir ejercicios reales del catálogo sobre inventar uno nuevo.",
  input_schema: {
    type: "object",
    properties: {
      bodyPart: { type: "string", description: "Parte del cuerpo del ejercicio actual, p.ej. 'chest', 'back', 'upper legs', 'biceps', 'triceps'." },
      target: { type: "string", description: "Músculo específico objetivo, p.ej. 'biceps', 'abs', 'pectorals'." },
      equipment: { type: "array", items: { type: "string" }, description: "Valores de equipo a buscar, p.ej. ['dumbbell','body weight']." },
      keyword: { type: "string", description: "Palabra clave para buscar en el nombre del ejercicio." },
    },
  },
};

const proposeExerciseOptionsTool: Anthropic.Tool = {
  name: "propose_exercise_options",
  description:
    "Propone exactamente 3 opciones de ejercicio para reemplazar el actual. Cada opción debe ser 'catalog' (referenciando un exerciseId real que ya viste en los resultados de search_exercise_catalog) o 'ai_generated' (SOLO si, tras buscar, de verdad no hay ninguna alternativa razonable en el catálogo).",
  input_schema: {
    type: "object",
    properties: {
      options: { type: "array", items: EXERCISE_OPTION_JSON_SCHEMA, minItems: 3, maxItems: 3 },
    },
    required: ["options"],
  },
};

const MODE_BLOCKS: Record<ExerciseSwapMode, string> = {
  equipment_unavailable:
    "Modo actual: 'El aparato no está en mi gym'. El usuario no tiene disponible la máquina/aparato de este ejercicio. Pregúntale (si aún no te lo ha dicho) qué máquinas, aparatos o equipo SÍ ve disponibles para este grupo muscular en su gym, en sus propias palabras. Usa esa descripción para decidir qué equipo buscar en el catálogo (mapea su descripción libre a valores de equipo conocidos: body weight, dumbbell, cable, barbell, leverage machine, band, kettlebell, etc.). Una vez que tengas suficiente información, busca en el catálogo y propón 3 opciones.",
  technique_help:
    "Modo actual: 'No entendí cómo hacer el ejercicio'. Sigue esta secuencia estrictamente: (1) Pregunta primero si sintió incomodidad o dolor al hacer el ejercicio actual. (2) Si no reporta dolor y solo no entendió la técnica, explícasela de forma clara y por pasos UNA sola vez, anímalo a intentarlo de nuevo, y responde solo en texto — NO llames propose_exercise_options todavía. (3) Solo si, después de tu explicación, el usuario dice que prefiere cambiar el ejercicio (o si reportó dolor/incomodidad), pregúntale qué equipo tiene disponible para este grupo muscular (igual que en el modo de aparato no disponible) y entonces sí busca en el catálogo y propón 3 opciones.",
};

function buildExerciseSwapSystemPrompt(mode: ExerciseSwapMode, bodyPart: string, currentExerciseName: string): string {
  return [
    "Eres el copiloto de la app 'KelthApp'. Tu tarea en esta conversación es ayudar a la persona a reemplazar UN ejercicio específico de su rutina semanal con una alternativa mejor, hablando siempre en español de México.",
    `El ejercicio a reemplazar es: "${currentExerciseName}" (grupo muscular: ${bodyPart}).`,
    "",
    buildPersonalizationSummary(null, "fullbody", "gym", []),
    "",
    MODE_BLOCKS[mode],
    "",
    "Regla dura: SIEMPRE llama primero a search_exercise_catalog con la parte del cuerpo/target del ejercicio actual antes de considerar proponer un ejercicio inventado. Solo usa kind: 'ai_generated' si, tras buscar, ningún resultado es una alternativa razonable dado lo que el usuario describió. Nunca inventes un exerciseId — solo usa ids que hayas visto en los resultados de search_exercise_catalog.",
    "Cuando ya tengas información suficiente, SIEMPRE debes proponer exactamente 3 opciones distintas usando la herramienta propose_exercise_options — nunca menos, nunca más, y nunca las describas solo en texto plano.",
  ].join("\n");
}

export interface ExerciseSwapChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type ExerciseSwapTurnResult =
  | { status: "message"; reply: string }
  | { status: "options"; options: ExerciseOption[] }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function toAnthropicMessages(turns: ExerciseSwapChatTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn): Anthropic.MessageParam => ({ role: turn.role, content: turn.text }));
}

export function findAllToolUses(response: Anthropic.Message, name: string): Anthropic.ToolUseBlock[] {
  return response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === name);
}

export function findToolUse(response: Anthropic.Message, name: string): Anthropic.ToolUseBlock | undefined {
  return findAllToolUses(response, name)[0];
}

// Anthropic requires a tool_result for every tool_use block in the assistant's
// message before any later message in the same request — including a plain-text
// "please retry" nudge. Any tool_use blocks we're not otherwise handling on this
// turn (e.g. a propose call sitting alongside search calls) still need a stub
// result so the corrective retry request stays valid.
export function stubToolResultsFor(toolUses: Anthropic.ToolUseBlock[], skipId?: string): Anthropic.ToolResultBlockParam[] {
  return toolUses.filter((use) => use.id !== skipId).map((use) => ({ type: "tool_result", tool_use_id: use.id, content: "" }));
}

export function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function runCatalogSearch(input: unknown): Promise<Array<{ id: string; name: string; bodyPart: string; target: string; equipment: string }>> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rawBodyPart = typeof raw.bodyPart === "string" ? raw.bodyPart : undefined;
  const explicitTarget = typeof raw.target === "string" ? raw.target : undefined;
  const equipment = Array.isArray(raw.equipment) ? raw.equipment.filter((e): e is string => typeof e === "string") : undefined;
  const keyword = typeof raw.keyword === "string" ? raw.keyword : undefined;

  const where: Record<string, unknown> = { source: "seed" };
  if (rawBodyPart) {
    const mapped = TARGET_FILTERED_BODY_PARTS[rawBodyPart];
    if (mapped) {
      where.bodyPart = mapped;
      where.target = explicitTarget ?? rawBodyPart;
    } else {
      where.bodyPart = rawBodyPart;
      if (explicitTarget) where.target = explicitTarget;
    }
  } else if (explicitTarget) {
    where.target = explicitTarget;
  }
  if (equipment && equipment.length > 0) where.equipment = { in: equipment };
  if (keyword) where.name = { contains: keyword, mode: "insensitive" };

  return prisma.exercise.findMany({
    where,
    take: 8,
    select: { id: true, name: true, bodyPart: true, target: true, equipment: true },
  });
}

async function callAssistant(system: string, messages: Anthropic.MessageParam[]) {
  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: [searchExerciseCatalogTool, proposeExerciseOptionsTool],
    tool_choice: { type: "auto" },
    messages,
  });
}

export async function runExerciseSwapChatTurn(
  mode: ExerciseSwapMode,
  bodyPart: string,
  currentExerciseName: string,
  turns: ExerciseSwapChatTurn[],
): Promise<ExerciseSwapTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unavailable" };
  }

  const system = buildExerciseSwapSystemPrompt(mode, bodyPart, currentExerciseName);
  let messages = toAnthropicMessages(turns);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
      const response = await callAssistant(system, messages);

      if (response.stop_reason !== "tool_use") {
        return { status: "message", reply: textOf(response) };
      }

      const allToolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const proposeUse = allToolUses.find((u) => u.name === "propose_exercise_options");
      if (proposeUse) {
        let parsed = proposeExerciseOptionsInputSchema.safeParse(proposeUse.input);

        if (!parsed.success) {
          // One corrective retry: nudge the model via a tool_result (every tool_use
          // block in this response needs one, including any other calls made
          // alongside the invalid propose call).
          const retryMessages: Anthropic.MessageParam[] = [
            ...messages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: proposeUse.id,
                  is_error: true,
                  content:
                    "Recuerda: debes llamar propose_exercise_options con exactamente 3 opciones distintas, cada una 'catalog' (con un exerciseId visto en tus búsquedas) o 'ai_generated' (con todos los campos del draft).",
                },
                ...stubToolResultsFor(allToolUses, proposeUse.id),
              ],
            },
          ];
          const retryResponse = await callAssistant(system, retryMessages);
          if (retryResponse.stop_reason === "tool_use") {
            const retryToolUse = findToolUse(retryResponse, "propose_exercise_options");
            parsed = proposeExerciseOptionsInputSchema.safeParse(retryToolUse?.input);
          }
        }

        if (!parsed.success) {
          return { status: "error", message: "El asistente no pudo generar 3 opciones válidas" };
        }

        return { status: "options", options: parsed.data.options };
      }

      const searchUses = allToolUses.filter((u) => u.name === "search_exercise_catalog");
      if (searchUses.length > 0) {
        const searchResults = await Promise.all(
          searchUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => ({
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(await runCatalogSearch(use.input)),
          })),
        );
        messages = [
          ...messages,
          { role: "assistant", content: response.content },
          { role: "user", content: [...searchResults, ...stubToolResultsFor(allToolUses.filter((u) => u.name !== "search_exercise_catalog"))] },
        ];
        continue;
      }

      // Unrecognized tool use — treat as a dead end rather than looping forever.
      return { status: "message", reply: textOf(response) };
    }

    return { status: "error", message: "El asistente no pudo generar 3 opciones válidas" };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
