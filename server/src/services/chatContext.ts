import { MealPlan, MealPlanEntry, Recipe } from "@prisma/client";
import lowcarb from "../data/diets/lowcarb.json";

const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const SLOT_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  colacion_am: "Colación matutina",
  comida: "Comida",
  colacion_pm: "Colación vespertina",
  cena: "Cena",
};
const SLOT_ORDER = ["desayuno", "colacion_am", "comida", "colacion_pm", "cena"];

type MealPlanWithEntries = MealPlan & { entries: (MealPlanEntry & { recipe: Recipe })[] };

function buildDietSummary(): string {
  const prohibited = Object.values(lowcarb.prohibited).flat().join(", ");
  const moderate = Object.entries(lowcarb.moderateEquivalents)
    .filter(([key]) => key !== "_notes")
    .map(([, def]) => {
      const d = def as { label: string; dailyBudget?: number; portion?: string };
      return `${d.label} (máx. ${d.dailyBudget ?? "?"} equivalente(s)/día)`;
    })
    .join(", ");

  return [
    `Dieta: ${lowcarb.name}. ${lowcarb.description}`,
    `Alimentos PROHIBIDOS: ${prohibited}.`,
    `Alimentos de consumo MODERADO (equivalentes permitidos al día): ${moderate}.`,
    `Las verduras (crudas y cocidas), proteínas magras (pollo, pescado, pavo, huevo), hierbas, especias y bebidas sin azúcar son de consumo LIBRE. Res, cerdo y mariscos se recomiendan máximo 1 vez por semana.`,
  ].join("\n");
}

function buildMealPlanSummary(mealPlan: MealPlanWithEntries | null): string {
  if (!mealPlan || mealPlan.entries.length === 0) {
    return "El usuario aún no tiene un menú semanal generado.";
  }

  const byDay = new Map<number, (MealPlanEntry & { recipe: Recipe })[]>();
  for (const entry of mealPlan.entries) {
    if (!byDay.has(entry.dayIndex)) byDay.set(entry.dayIndex, []);
    byDay.get(entry.dayIndex)!.push(entry);
  }

  const lines: string[] = [`Menú semanal actual del usuario (inicia ${mealPlan.weekStart.toISOString().slice(0, 10)}):`];
  for (let day = 0; day < 7; day++) {
    const entries = (byDay.get(day) || []).slice().sort((a, b) => SLOT_ORDER.indexOf(a.mealSlot) - SLOT_ORDER.indexOf(b.mealSlot));
    if (entries.length === 0) continue;
    const dayLine = entries.map((e) => `${SLOT_LABELS[e.mealSlot] || e.mealSlot}: ${e.recipe.name}`).join(" | ");
    lines.push(`${DAY_NAMES[day]}: ${dayLine}`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(mealsPerDay: number, mealPlan: MealPlanWithEntries | null): string {
  return [
    "Eres un asistente nutricional cálido, claro y motivador que habla siempre en español de México.",
    "Ayudas a una persona que sigue el plan de alimentación Low Carb descrito abajo, dentro de la app 'El Mejor Menú'.",
    "Responde dudas sobre su menú semanal, sugiere sustituciones dentro de las reglas de la dieta, y da consejos prácticos y realistas (cocina mexicana de tiempos modernos: mercados, ingredientes accesibles).",
    "Si el usuario pregunta por algo de la lista de PROHIBIDOS, explica amablemente por qué conviene evitarlo y ofrece una alternativa permitida.",
    "No inventes información médica; si preguntan algo que requiere un profesional de salud (medicamentos, condiciones médicas serias), sugiere consultar a su nutriólogo o médico.",
    "",
    `El usuario come ${mealsPerDay} veces al día.`,
    "",
    buildDietSummary(),
    "",
    buildMealPlanSummary(mealPlan),
  ].join("\n");
}
