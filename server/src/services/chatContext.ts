import { Exercise, MealPlan, MealPlanEntry, Recipe, Routine, RoutineEntry } from "@prisma/client";
import lowcarb from "../data/diets/lowcarb.json";
import maintenance from "../data/diets/maintenance.json";
import muscleGain from "../data/diets/muscle-gain.json";

// Solo se tipan los campos que este módulo realmente usa; cada dieta trae
// además sus propios `prohibited`/`free`/`goal` con formas distintas.
interface DietContent {
  name: string;
  description: string;
  prohibited: Record<string, unknown>;
  moderateEquivalents: Record<string, unknown>;
}

const DIET_BY_ID: Record<string, DietContent> = {
  lowcarb,
  maintenance,
  "muscle-gain": muscleGain,
};

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
type RoutineWithEntries = Routine & { entries: (RoutineEntry & { exercise: Exercise })[] };

export function buildDietSummary(dietId: string = "lowcarb"): string {
  const diet = DIET_BY_ID[dietId] ?? lowcarb;
  const prohibited = Object.entries(diet.prohibited)
    .filter(([key]) => key !== "_notes")
    .flatMap(([, items]) => items as string[])
    .join(", ");
  const moderate = Object.entries(diet.moderateEquivalents)
    .filter(([key]) => key !== "_notes")
    .map(([, def]) => {
      const d = def as { label: string; dailyBudget?: number; portion?: string };
      return `${d.label} (máx. ${d.dailyBudget ?? "?"} equivalente(s)/día)`;
    })
    .join(", ");

  const proteinNote =
    dietId === "muscle-gain"
      ? "Res, cerdo y mariscos ya no están limitados: se pueden usar casi a diario en cortes magros para sostener el aporte de proteína."
      : "Res, cerdo y mariscos se recomiendan máximo 1 vez por semana.";

  return [
    `Dieta: ${diet.name}. ${diet.description}`,
    `Alimentos PROHIBIDOS: ${prohibited}.`,
    `Alimentos de consumo MODERADO (equivalentes permitidos al día): ${moderate}.`,
    `Las verduras (crudas y cocidas), proteínas magras (pollo, pescado, pavo, huevo), hierbas, especias y bebidas sin azúcar son de consumo LIBRE. ${proteinNote}`,
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

function formatSetScheme(entry: RoutineEntry): string {
  if (entry.durationSeconds != null) return `${entry.sets} series x ${entry.durationSeconds}s`;
  return `${entry.sets} series x ${entry.reps ?? "?"} reps`;
}

export function buildRoutineSummary(routine: RoutineWithEntries | null): string {
  if (!routine || routine.entries.length === 0) {
    return "El usuario aún no tiene una rutina de ejercicio generada.";
  }

  const byDay = new Map<number, (RoutineEntry & { exercise: Exercise })[]>();
  for (const entry of routine.entries) {
    if (!byDay.has(entry.dayIndex)) byDay.set(entry.dayIndex, []);
    byDay.get(entry.dayIndex)!.push(entry);
  }

  const lines: string[] = [
    `Rutina de ejercicio actual del usuario (${routine.daysPerWeek} días/semana, inicia ${routine.weekStart.toISOString().slice(0, 10)}):`,
  ];
  for (let day = 0; day < 7; day++) {
    const entries = byDay.get(day) || [];
    if (entries.length === 0) continue;
    const dayLine = entries
      .map((e) => `${e.exercise.name} (${e.bodyPart}): ${formatSetScheme(e)}`)
      .join(" | ");
    lines.push(`${DAY_NAMES[day]}: ${dayLine}`);
  }

  return lines.join("\n");
}

const GENDER_LABELS: Record<string, string> = {
  hombre: "hombre",
  mujer: "mujer",
  prefiero_no_decir: "género no especificado",
};

const RESTRICTION_LABELS: Record<string, string> = {
  vegetariano: "vegetariano",
  vegano: "vegano",
  sin_lacteos: "sin lácteos",
  sin_nueces: "sin nueces",
  sin_mariscos: "sin mariscos",
  sin_gluten: "sin gluten",
};

export function buildPersonalizationSummary(
  gender: string | null,
  splitType: string,
  equipmentPreference: string,
  dietaryRestrictions: string[],
): string {
  const genderText = gender ? GENDER_LABELS[gender] ?? gender : "no especificado";
  const splitText = splitType === "split" ? "split por parte del cuerpo (push/pull/legs)" : "rutina de cuerpo completo (fullbody)";
  const equipmentText = equipmentPreference === "home" ? "en casa con equipo básico" : "en el gimnasio";
  const restrictionsText =
    dietaryRestrictions.length > 0
      ? dietaryRestrictions.map((r) => RESTRICTION_LABELS[r] ?? r).join(", ")
      : "ninguna";

  return `El usuario es ${genderText}, entrena ${equipmentText} siguiendo un(a) ${splitText}, y tiene estas restricciones alimentarias: ${restrictionsText}.`;
}

export function buildSystemPrompt(
  mealsPerDay: number,
  mealPlan: MealPlanWithEntries | null,
  routine: RoutineWithEntries | null,
  gender: string | null = null,
  splitType: string = "fullbody",
  equipmentPreference: string = "gym",
  dietaryRestrictions: string[] = [],
  dietId: string = "lowcarb",
): string {
  return [
    "Eres el copiloto de la app 'KelthApp': un asistente cálido, claro y motivador que habla siempre en español de México.",
    "Ayudas a la persona tanto con su alimentación (dieta descrita abajo, según su objetivo actual) como con su rutina de ejercicio, de forma integrada — puedes hablar de ambas en la misma conversación.",
    "En nutrición: responde dudas sobre su menú semanal, sugiere sustituciones dentro de las reglas de la dieta, y da consejos prácticos y realistas (cocina mexicana de tiempos modernos: mercados, ingredientes accesibles).",
    "Si el usuario pregunta por algo de la lista de PROHIBIDOS, explica amablemente por qué conviene evitarlo y ofrece una alternativa permitida.",
    "En ejercicio: responde dudas sobre su rutina semanal, explica cómo ejecutar los ejercicios con buena técnica, sugiere ajustes de series/repeticiones razonables según su nivel, y motívalo a mantener consistencia.",
    "No inventes información médica; si preguntan algo que requiere un profesional de salud (medicamentos, lesiones, condiciones médicas serias), sugiere consultar a su nutriólogo, entrenador o médico según corresponda.",
    "",
    `El usuario come ${mealsPerDay} veces al día.`,
    buildPersonalizationSummary(gender, splitType, equipmentPreference, dietaryRestrictions),
    "",
    buildDietSummary(dietId),
    "",
    buildMealPlanSummary(mealPlan),
    "",
    buildRoutineSummary(routine),
  ].join("\n");
}
