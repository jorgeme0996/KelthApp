import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildDietSummary } from "./chatContext";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const MEAL_SLOTS = ["desayuno", "colacion_am", "comida", "colacion_pm", "cena"] as const;
const SLOT_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  colacion_am: "Colación matutina",
  comida: "Comida",
  colacion_pm: "Colación vespertina",
  cena: "Cena",
};

export type MealSwapMode = "fridge" | "restaurant_options" | "menu_photo";

export const ingredientDraftSchema = z.object({
  name: z.string().min(1),
  qty: z.number().nonnegative(),
  unit: z.string().min(1),
  category: z.string().min(1),
});

export const recipeDraftSchema = z.object({
  name: z.string().min(1).max(120),
  mealSlots: z.array(z.enum(MEAL_SLOTS)).min(1),
  cuisineTags: z.array(z.string()).default([]),
  ingredients: z.array(ingredientDraftSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  equivalents: z.record(z.string(), z.number()).default({}),
  weeklyLimited: z.boolean().default(false),
  prepTimeMinutes: z.number().int().positive().nullable().optional(),
  dietType: z.string().default("lowcarb"),
});

export const proposeMealOptionsInputSchema = z.object({
  options: z.array(recipeDraftSchema).length(3),
});

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

const RECIPE_DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    mealSlots: { type: "array", items: { type: "string", enum: MEAL_SLOTS } },
    cuisineTags: { type: "array", items: { type: "string" } },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          category: { type: "string" },
        },
        required: ["name", "qty", "unit", "category"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
    equivalents: { type: "object", additionalProperties: { type: "number" } },
    weeklyLimited: { type: "boolean" },
    prepTimeMinutes: { type: ["integer", "null"] },
    dietType: { type: "string" },
  },
  required: ["name", "mealSlots", "cuisineTags", "ingredients", "steps", "equivalents", "weeklyLimited", "dietType"],
};

const proposeMealOptionsTool: Anthropic.Tool = {
  name: "propose_meal_options",
  description:
    "Propone exactamente 3 opciones de receta para reemplazar la comida actual del usuario. Solo se debe llamar cuando ya se tiene información suficiente (ingredientes disponibles, opciones de restaurante, o contenido del menú fotografiado) para dar 3 opciones distintas y razonables.",
  input_schema: {
    type: "object",
    properties: {
      options: { type: "array", items: RECIPE_DRAFT_JSON_SCHEMA, minItems: 3, maxItems: 3 },
    },
    required: ["options"],
  },
};

const MODE_BLOCKS: Record<MealSwapMode, string> = {
  fridge:
    "Modo actual: 'Qué tengo en el refri'. El usuario te va a decir qué ingredientes tiene disponibles en casa. Pregunta si falta información importante (por ejemplo si no mencionó una fuente de proteína, verduras o grasas) antes de proponer opciones. Las 3 recetas que propongas deben poder prepararse principalmente con los ingredientes que el usuario mencionó.",
  restaurant_options:
    "Modo actual: 'Voy a pedir comida'. El usuario está por pedir comida a domicilio y te va a dar una lista de restaurantes o platillos que está considerando. Ayúdalo a decidir cuál elegir y qué pedir ahí, alineado con su dieta. Las 3 opciones deben basarse en las alternativas reales que el usuario mencionó (o platillos típicos de esos restaurantes).",
  menu_photo:
    "Modo actual: 'Ya estoy en el restaurante'. El usuario te compartirá una foto del menú físico del restaurante donde está. Lee el menú cuidadosamente y recomienda qué pedir de ahí. Si la foto no es legible o no logras leer los platillos con claridad, dilo explícitamente y pide que la vuelva a tomar — nunca inventes platillos que no puedas leer en la foto. Las 3 opciones deben ser platillos que realmente aparecen en el menú fotografiado (puedes sugerir quitar/cambiar un acompañamiento si eso ayuda a que encaje mejor en la dieta).",
};

function buildMealSwapSystemPrompt(
  mode: MealSwapMode,
  mealSlot: string,
  currentRecipeName: string,
  dietId: string,
): string {
  return [
    "Eres el copiloto de la app 'KelthApp'. Tu tarea en esta conversación es ayudar a la persona a reemplazar UNA comida específica de su menú semanal con una alternativa mejor, hablando siempre en español de México.",
    `La comida a reemplazar es: ${SLOT_LABELS[mealSlot] ?? mealSlot} (actualmente: "${currentRecipeName}").`,
    "",
    buildDietSummary(dietId),
    "",
    MODE_BLOCKS[mode],
    "",
    "No llames la herramienta propose_meal_options hasta que tengas información suficiente para dar 3 opciones distintas, razonables y que respeten las reglas de la dieta. Si falta información importante, pregunta primero en texto plano, de forma breve y conversacional.",
    "Cuando ya tengas información suficiente, SIEMPRE debes proponer exactamente 3 opciones distintas usando la herramienta — nunca menos, nunca más, y nunca las describas solo en texto plano.",
    "Cada opción debe incluir ingredientes con cantidades razonables, pasos de preparación claros, y una estimación honesta de equivalentes de la dieta (cereal, proteína, grasa, etc., según aplique).",
  ].join("\n");
}

export interface MealSwapChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface MealSwapImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

export type MealSwapTurnResult =
  | { status: "message"; reply: string }
  | { status: "options"; options: RecipeDraft[] }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function toAnthropicMessages(turns: MealSwapChatTurn[], image?: MealSwapImage): Anthropic.MessageParam[] {
  const lastUserIndex = [...turns].map((t) => t.role).lastIndexOf("user");

  return turns.map((turn, index): Anthropic.MessageParam => {
    if (image && index === lastUserIndex) {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.dataBase64 } },
          { type: "text", text: turn.text || "Aquí está la foto del menú del restaurante." },
        ],
      };
    }
    return { role: turn.role, content: turn.text };
  });
}

async function callAssistant(system: string, messages: Anthropic.MessageParam[]) {
  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: [proposeMealOptionsTool],
    tool_choice: { type: "auto" },
    messages,
  });
}

export async function runMealSwapChatTurn(
  mode: MealSwapMode,
  mealSlot: string,
  currentRecipeName: string,
  turns: MealSwapChatTurn[],
  image?: MealSwapImage,
  dietId: string = "lowcarb",
): Promise<MealSwapTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unavailable" };
  }

  const system = buildMealSwapSystemPrompt(mode, mealSlot, currentRecipeName, dietId);
  const messages = toAnthropicMessages(turns, image);

  try {
    let response = await callAssistant(system, messages);

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "propose_meal_options",
      );
      let parsed = proposeMealOptionsInputSchema.safeParse(toolUse?.input);

      if (!parsed.success && toolUse) {
        // One corrective retry: nudge the model via a tool_result — Anthropic
        // requires every tool_use block to get a tool_result in the very next
        // message, a plain-text user turn here would 400.
        const retryMessages: Anthropic.MessageParam[] = [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                is_error: true,
                content:
                  "Recuerda: debes llamar propose_meal_options con exactamente 3 opciones distintas, cada una con todos los campos requeridos (name, mealSlots, ingredients, steps, equivalents, dietType).",
              },
            ],
          },
        ];
        response = await callAssistant(system, retryMessages);
        if (response.stop_reason === "tool_use") {
          const retryToolUse = response.content.find(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "propose_meal_options",
          );
          parsed = proposeMealOptionsInputSchema.safeParse(retryToolUse?.input);
        }
      }

      if (!parsed.success) {
        return { status: "error", message: "El asistente no pudo generar 3 opciones válidas" };
      }

      return { status: "options", options: parsed.data.options };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { status: "message", reply: text };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
