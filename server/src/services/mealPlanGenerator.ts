import { Recipe } from "@prisma/client";
import lowcarbRules from "../data/diets/lowcarb.json";
import maintenanceRules from "../data/diets/maintenance.json";
import muscleGainRules from "../data/diets/muscle-gain.json";
import { prisma } from "../prisma";

const DAYS_PER_WEEK = 7;

type Equivalents = Record<string, number>;

// Solo se tipan los campos que este servicio realmente usa; cada dieta trae
// además sus propios `prohibited`/`free`/`goal` con formas distintas.
interface DietRules {
  moderateEquivalents: Record<string, unknown>;
  mealSlotsByMealsPerDay: Record<string, string[]>;
}

interface GeneratedEntry {
  dayIndex: number;
  mealSlot: string;
  recipeId: string;
}

// Presupuestos de porciones y slots de comida según el objetivo del usuario
// (ver server/src/lib/dietGoal.ts para el mapeo goal -> dietId). El catálogo
// de recetas (Recipe.dietType) es independiente y sigue siendo "lowcarb".
const DIET_RULES_BY_ID: Record<string, DietRules> = {
  lowcarb: lowcarbRules,
  maintenance: maintenanceRules,
  "muscle-gain": muscleGainRules,
};

function getDietRules(dietId: string): DietRules {
  return DIET_RULES_BY_ID[dietId] ?? lowcarbRules;
}

function getDailyBudgets(dietRules: DietRules): Record<string, number> {
  const budgets: Record<string, number> = {};
  for (const [category, def] of Object.entries(dietRules.moderateEquivalents)) {
    if (category === "_notes") continue;
    const typed = def as { dailyBudget?: number };
    if (typeof typed.dailyBudget === "number") {
      budgets[category] = typed.dailyBudget;
    }
  }
  return budgets;
}

function fitsBudget(equivalents: Equivalents, dayTotals: Record<string, number>, budgets: Record<string, number>): boolean {
  for (const [category, amount] of Object.entries(equivalents)) {
    const budget = budgets[category];
    if (budget === undefined) continue;
    const current = dayTotals[category] || 0;
    if (current + amount > budget) return false;
  }
  return true;
}

function addEquivalents(equivalents: Equivalents, dayTotals: Record<string, number>) {
  for (const [category, amount] of Object.entries(equivalents)) {
    dayTotals[category] = (dayTotals[category] || 0) + amount;
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Coincidencia de texto (best-effort, igual que la lista `prohibited` de
// lowcarb.json) sobre el nombre de cada ingrediente de la receta.
const MEAT_PATTERN = /pollo|pavo|res\b|cerdo|pescado|at[uú]n|camar[oó]n|marisco|jam[oó]n|tocino|carne/i;

const RESTRICTION_PATTERNS: Record<string, RegExp> = {
  vegetariano: MEAT_PATTERN,
  vegano: new RegExp(MEAT_PATTERN.source + "|huevo|queso|crema|yogur|leche", "i"),
  sin_lacteos: /queso|crema|yogur|leche/i,
  sin_nueces: /almendra|nuez|cacahuate|ajonjol[ií]/i,
  sin_mariscos: /pescado|at[uú]n|camar[oó]n|marisco/i,
  sin_gluten: /bolillo|pan\b|harina de trigo|avena/i,
};

function filterByDietaryRestrictions(recipes: Recipe[], restrictions: string[]): Recipe[] {
  if (restrictions.length === 0) return recipes;
  const patterns = restrictions.map((r) => RESTRICTION_PATTERNS[r]).filter((p): p is RegExp => !!p);
  if (patterns.length === 0) return recipes;

  return recipes.filter((recipe) => {
    const ingredients = recipe.ingredients as unknown as { name: string }[];
    return !ingredients.some((ing) => patterns.some((pattern) => pattern.test(ing.name)));
  });
}

/**
 * Generates a 7-day meal plan for the given diet, respecting daily equivalent
 * budgets, rotating recipes for variety, and limiting "weeklyLimited" recipes
 * (e.g. red meat / mariscos) to once per week across the whole plan.
 */
export function generateMealPlanEntries(recipes: Recipe[], mealsPerDay: number, dietId = "lowcarb"): GeneratedEntry[] {
  const dietRules = getDietRules(dietId);
  const slotsKey = String(mealsPerDay) as keyof typeof dietRules.mealSlotsByMealsPerDay;
  const slots = dietRules.mealSlotsByMealsPerDay[slotsKey] || dietRules.mealSlotsByMealsPerDay["4"];
  const budgets = getDailyBudgets(dietRules);

  const bySlot: Record<string, Recipe[]> = {};
  for (const slot of slots) {
    bySlot[slot] = recipes.filter((r) => r.mealSlots.includes(slot));
  }

  const usedWeeklyLimited = new Set<string>();
  const recentBySlot: Record<string, string[]> = {};
  const entries: GeneratedEntry[] = [];

  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    const dayTotals: Record<string, number> = {};

    for (const slot of slots) {
      const all = bySlot[slot] || [];
      if (all.length === 0) continue;

      const eligible = all.filter((r) => {
        if (r.weeklyLimited && usedWeeklyLimited.has(r.id)) return false;
        return fitsBudget((r.equivalents as unknown as Equivalents) || {}, dayTotals, budgets);
      });

      const recent = recentBySlot[slot] || [];
      let pool = eligible.filter((r) => !recent.includes(r.id));
      if (pool.length === 0) pool = eligible;
      if (pool.length === 0) pool = all.filter((r) => !recent.includes(r.id));
      if (pool.length === 0) pool = all;

      const pick = pickRandom(pool);
      addEquivalents((pick.equivalents as unknown as Equivalents) || {}, dayTotals);
      if (pick.weeklyLimited) usedWeeklyLimited.add(pick.id);

      recentBySlot[slot] = [...recent, pick.id].slice(-3);
      entries.push({ dayIndex: day, mealSlot: slot, recipeId: pick.id });
    }
  }

  return entries;
}

export async function generateAndSaveMealPlan(
  userId: string,
  mealsPerDay: number,
  dietType: string,
  weekStart: Date,
  dietaryRestrictions: string[] = [],
  dietId = "lowcarb",
) {
  const recipes = await prisma.recipe.findMany({ where: { dietType } });
  if (recipes.length === 0) {
    throw new Error("No hay recetas disponibles para esta dieta. Ejecuta el seed primero.");
  }

  let eligibleRecipes = filterByDietaryRestrictions(recipes, dietaryRestrictions);
  if (eligibleRecipes.length === 0) {
    console.warn(
      `Las restricciones (${dietaryRestrictions.join(", ")}) dejaron el catálogo de recetas vacío; se usa el catálogo completo como respaldo.`,
    );
    eligibleRecipes = recipes;
  }

  const entries = generateMealPlanEntries(eligibleRecipes, mealsPerDay, dietId);

  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId,
      mealsPerDay,
      weekStart,
      entries: {
        create: entries.map((e) => ({
          dayIndex: e.dayIndex,
          mealSlot: e.mealSlot,
          recipeId: e.recipeId,
        })),
      },
    },
    include: {
      entries: { include: { recipe: true } },
    },
  });

  return mealPlan;
}

/**
 * Regenerates the entries for a single day of an existing meal plan, leaving
 * the rest of the week untouched. Meal slots already checked off as completed
 * are left as-is (their equivalents still count toward the day's budget).
 * Respects the same daily equivalent budgets as full-week generation, and
 * avoids re-picking a "weeklyLimited" recipe already used elsewhere in the plan.
 */
export async function regenerateMealPlanDay(
  mealPlanId: string,
  dayIndex: number,
  mealsPerDay: number,
  dietType: string,
  dietaryRestrictions: string[] = [],
  dietId = "lowcarb",
) {
  const recipes = await prisma.recipe.findMany({ where: { dietType } });
  if (recipes.length === 0) {
    throw new Error("No hay recetas disponibles para esta dieta. Ejecuta el seed primero.");
  }

  let eligibleRecipes = filterByDietaryRestrictions(recipes, dietaryRestrictions);
  if (eligibleRecipes.length === 0) eligibleRecipes = recipes;

  const dayEntries = await prisma.mealPlanEntry.findMany({
    where: { mealPlanId, dayIndex },
    include: { recipe: true },
  });
  const completedEntries = dayEntries.filter((e) => e.completedAt !== null);
  const completedSlots = new Set(completedEntries.map((e) => e.mealSlot));

  const otherEntries = await prisma.mealPlanEntry.findMany({
    where: { mealPlanId, dayIndex: { not: dayIndex } },
    include: { recipe: true },
  });
  const usedWeeklyLimited = new Set(
    [...otherEntries, ...completedEntries].filter((e) => e.recipe.weeklyLimited).map((e) => e.recipeId),
  );

  const dietRules = getDietRules(dietId);
  const slotsKey = String(mealsPerDay) as keyof typeof dietRules.mealSlotsByMealsPerDay;
  const allSlots = dietRules.mealSlotsByMealsPerDay[slotsKey] || dietRules.mealSlotsByMealsPerDay["4"];
  const slots = allSlots.filter((slot) => !completedSlots.has(slot));
  if (slots.length === 0) {
    throw new Error("Ya completaste todas las comidas de este día, no hay nada que regenerar");
  }

  const budgets = getDailyBudgets(dietRules);

  const bySlot: Record<string, Recipe[]> = {};
  for (const slot of slots) {
    bySlot[slot] = eligibleRecipes.filter((r) => r.mealSlots.includes(slot));
  }

  const dayTotals: Record<string, number> = {};
  for (const entry of completedEntries) {
    addEquivalents((entry.recipe.equivalents as unknown as Equivalents) || {}, dayTotals);
  }

  const newEntries: { mealSlot: string; recipeId: string }[] = [];

  for (const slot of slots) {
    const all = bySlot[slot] || [];
    if (all.length === 0) continue;

    const eligible = all.filter((r) => {
      if (r.weeklyLimited && usedWeeklyLimited.has(r.id)) return false;
      return fitsBudget((r.equivalents as unknown as Equivalents) || {}, dayTotals, budgets);
    });
    const pool = eligible.length > 0 ? eligible : all;

    const pick = pickRandom(pool);
    addEquivalents((pick.equivalents as unknown as Equivalents) || {}, dayTotals);
    if (pick.weeklyLimited) usedWeeklyLimited.add(pick.id);

    newEntries.push({ mealSlot: slot, recipeId: pick.id });
  }

  await prisma.$transaction([
    prisma.mealPlanEntry.deleteMany({ where: { mealPlanId, dayIndex, mealSlot: { in: slots } } }),
    prisma.mealPlanEntry.createMany({
      data: newEntries.map((e) => ({ mealPlanId, dayIndex, mealSlot: e.mealSlot, recipeId: e.recipeId })),
    }),
  ]);

  return prisma.mealPlan.findUniqueOrThrow({
    where: { id: mealPlanId },
    include: { entries: { include: { recipe: true } } },
  });
}
