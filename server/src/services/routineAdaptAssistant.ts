import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Routine, RoutineEntry, Exercise } from "@prisma/client";
import { buildPersonalizationSummary, buildRoutineSummary } from "./chatContext";
import {
  EXERCISE_OPTION_JSON_SCHEMA,
  exerciseOptionSchema,
  findToolUse,
  runCatalogSearch,
  searchExerciseCatalogTool,
  stubToolResultsFor,
  textOf,
} from "./exerciseSwapAssistant";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
// Higher than exerciseSwapAssistant's cap: a whole-routine adaptation can touch
// several days, each potentially needing its own search_exercise_catalog call
// (e.g. dropping every lying-down exercise across a 3-day week), so it needs more
// round trips to converge than a single-exercise swap does.
const MAX_TOOL_ROUNDTRIPS = 10;

type RoutineWithEntries = Routine & { entries: (RoutineEntry & { exercise: Exercise })[] };

const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

// buildRoutineSummary (from chatContext.ts) is prose meant for a human-facing chat
// assistant — it never includes real ids. The adaptation tool needs to reference
// exact RoutineEntry/Exercise ids, so this builds a separate machine-readable table
// the model must copy ids from verbatim instead of guessing them.
function buildRoutineEntriesReference(routine: RoutineWithEntries): string {
  const byDay = new Map<number, RoutineWithEntries["entries"]>();
  for (const entry of routine.entries) {
    if (!byDay.has(entry.dayIndex)) byDay.set(entry.dayIndex, []);
    byDay.get(entry.dayIndex)!.push(entry);
  }

  const lines = [
    "Tabla de referencia de la rutina actual — usa EXACTAMENTE estos valores de entryId y exerciseId, nunca los inventes ni los abrevies:",
  ];
  for (let day = 0; day < 7; day++) {
    const entries = byDay.get(day) ?? [];
    if (entries.length === 0) continue;
    lines.push(`${DAY_NAMES[day]} (dayIndex=${day}):`);
    for (const entry of entries) {
      const scheme = entry.durationSeconds != null ? `${entry.sets}x${entry.durationSeconds}s` : `${entry.sets}x${entry.reps ?? "?"}`;
      lines.push(`  entryId=${entry.id} exerciseId=${entry.exerciseId} bodyPart=${entry.bodyPart} nombre="${entry.exercise.name}" actual=${scheme}`);
    }
  }
  return lines.join("\n");
}

const dayChangeSchema = z
  .object({
    dayIndex: z.number().int().min(0).max(6),
    reason: z.string().min(1),
    entries: z
      .array(
        z.object({
          entryId: z.string().min(1),
          option: exerciseOptionSchema,
          sets: z.number().int().positive().optional(),
          reps: z.number().int().positive().nullable().optional(),
          durationSeconds: z.number().int().positive().nullable().optional(),
        }),
      )
      .default([]),
    // Entries to drop entirely from the day (e.g. genuinely fewer exercises for a
    // shorter workout, not just fewer sets on the same exercises).
    removeEntryIds: z.array(z.string().min(1)).default([]),
  })
  .refine((day) => day.entries.length > 0 || day.removeEntryIds.length > 0, {
    message: "Cada día modificado debe tener al menos un cambio de ejercicio o una eliminación.",
  });

export const proposeRoutineAdaptationInputSchema = z.object({
  summary: z.string().min(1),
  dayChanges: z.array(dayChangeSchema).min(1),
});

export type RoutineDayChange = z.infer<typeof dayChangeSchema>;
export type RoutineAdaptation = z.infer<typeof proposeRoutineAdaptationInputSchema>;

const DAY_CHANGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    dayIndex: { type: "integer", minimum: 0, maximum: 6 },
    reason: { type: "string", description: "Explicación breve, en español, de por qué cambia este día — se le muestra al usuario." },
    entries: {
      type: "array",
      description: "Entries que se mantienen ese día pero cambian de ejercicio y/o de sets/reps/duración.",
      items: {
        type: "object",
        properties: {
          entryId: { type: "string", description: "El id de RoutineEntry que se está actualizando, copiado EXACTO de la tabla de referencia." },
          option: EXERCISE_OPTION_JSON_SCHEMA,
          sets: { type: "integer" },
          reps: { type: ["integer", "null"] },
          durationSeconds: { type: ["integer", "null"] },
        },
        required: ["entryId", "option"],
      },
    },
    removeEntryIds: {
      type: "array",
      description: "entryIds a eliminar por completo de este día (p.ej. para de verdad tener menos ejercicios, no solo menos series), copiados EXACTOS de la tabla de referencia.",
      items: { type: "string" },
    },
  },
  required: ["dayIndex", "reason"],
};

const proposeRoutineAdaptationTool: Anthropic.Tool = {
  name: "propose_routine_adaptation",
  description:
    "Propone los cambios a la rutina semanal del usuario, incluyendo SOLO los días y ejercicios que realmente necesitan cambiar. Puede ser un cambio angosto (un solo día más corto) o amplio (quitar cierto tipo de ejercicio de todos los días restantes).",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Resumen breve de qué cambió y por qué, para mostrarle al usuario." },
      dayChanges: { type: "array", items: DAY_CHANGE_JSON_SCHEMA, minItems: 1 },
    },
    required: ["summary", "dayChanges"],
  },
};

function buildRoutineAdaptSystemPrompt(routine: RoutineWithEntries): string {
  return [
    "Eres el copiloto de la app 'KelthApp'. Tu tarea en esta conversación es ayudar a la persona a reorganizar/adaptar su rutina de ejercicio semanal completa, hablando siempre en español de México.",
    "",
    buildPersonalizationSummary(null, "fullbody", "gym", []),
    "",
    buildRoutineSummary(routine),
    "",
    buildRoutineEntriesReference(routine),
    "",
    "Pregunta primero qué no le gustó de su rutina de esta semana, si aún no te lo ha dicho.",
    "Ejemplos de adaptación que puedes ofrecer:",
    "1) Restricción de tiempo: si un día específico tiene menos tiempo disponible, da un entrenamiento más corto SOLO ese día — no toques los demás días. Para de verdad tener MENOS ejercicios (no solo menos series), usa removeEntryIds para eliminar esos entries del día por completo; usa 'entries' solo para los que se quedan pero cambian de sets/reps/duración o de ejercicio.",
    "2) Limitación física: si el usuario reporta una limitación (p.ej. 'no puedo acostarme, me cuesta pararme de nuevo'), deja de incluir ejercicios que se hacen acostado/en el piso — evalúa esto para TODOS los días restantes de la semana, no solo el que mencionó. No hay una bandera explícita de 'posición' en el catálogo, así que infiere la posición a partir del nombre e instrucciones del ejercicio (usa search_exercise_catalog y lee los resultados con cuidado).",
    "",
    "Reglas duras para propose_routine_adaptation:",
    "- entryId (en 'entries' y en 'removeEntryIds') SIEMPRE debe copiarse EXACTO de la tabla de referencia de arriba — nunca lo inventes ni lo abrevies (p.ej. nunca 'mon-1').",
    "- Si vas a mantener el mismo ejercicio de un entry y solo cambiarle sets/reps/duración (p.ej. para acortar un día), usa el MISMO exerciseId que ya tiene ese entry en la tabla — no necesitas buscarlo.",
    "- Si vas a reemplazar el ejercicio de un entry, SIEMPRE llama primero a search_exercise_catalog para buscar reemplazos reales del mismo grupo muscular antes de considerar proponer un ejercicio inventado (kind: 'ai_generated'). Solo invéntalo si de verdad no hay alternativa razonable en el catálogo. El exerciseId de una opción 'catalog' debe ser uno que hayas visto en los resultados de search_exercise_catalog.",
    "- Eficiencia (importante): identifica de una vez TODOS los bodyPart distintos que vas a necesitar buscar (puede haber el mismo bodyPart repetido en varios días — solo necesitas buscarlo UNA vez y reutilizar los resultados). Cuando llames a search_exercise_catalog, haz TODAS esas llamadas EN PARALELO dentro de una misma respuesta (varios tool_use en un solo turno) en lugar de una por una en turnos separados — tienes un número limitado de turnos.",
    "Cuando ya tengas información suficiente, llama a propose_routine_adaptation incluyendo SOLO los días que realmente cambian.",
  ].join("\n");
}

export interface RoutineAdaptChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type RoutineAdaptTurnResult =
  | { status: "message"; reply: string }
  | { status: "adaptation"; adaptation: RoutineAdaptation }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function toAnthropicMessages(turns: RoutineAdaptChatTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn): Anthropic.MessageParam => ({ role: turn.role, content: turn.text }));
}

async function callAssistant(system: string, messages: Anthropic.MessageParam[]) {
  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: [searchExerciseCatalogTool, proposeRoutineAdaptationTool],
    tool_choice: { type: "auto" },
    messages,
  });
}

export async function runRoutineAdaptChatTurn(
  routine: RoutineWithEntries,
  turns: RoutineAdaptChatTurn[],
): Promise<RoutineAdaptTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unavailable" };
  }

  const system = buildRoutineAdaptSystemPrompt(routine);
  let messages = toAnthropicMessages(turns);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
      const response = await callAssistant(system, messages);

      if (response.stop_reason !== "tool_use") {
        return { status: "message", reply: textOf(response) };
      }

      const allToolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const proposeUse = allToolUses.find((u) => u.name === "propose_routine_adaptation");
      if (proposeUse) {
        let parsed = proposeRoutineAdaptationInputSchema.safeParse(proposeUse.input);

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
                    "Recuerda: debes llamar propose_routine_adaptation con 'summary' y 'dayChanges' (solo los días que cambian), y cada entrada debe tener un entryId real de la rutina actual y una 'option' válida.",
                },
                ...stubToolResultsFor(allToolUses, proposeUse.id),
              ],
            },
          ];
          const retryResponse = await callAssistant(system, retryMessages);
          if (retryResponse.stop_reason === "tool_use") {
            const retryToolUse = findToolUse(retryResponse, "propose_routine_adaptation");
            parsed = proposeRoutineAdaptationInputSchema.safeParse(retryToolUse?.input);
          }
        }

        if (!parsed.success) {
          return { status: "error", message: "El asistente no pudo generar una adaptación válida" };
        }

        return { status: "adaptation", adaptation: parsed.data };
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

    return { status: "error", message: "El asistente no pudo generar una adaptación válida" };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
