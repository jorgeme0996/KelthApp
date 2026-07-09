import { Recipe } from "@prisma/client";
import dietRules from "../data/diets/lowcarb.json";
import { prisma } from "../prisma";

const DAYS_PER_WEEK = 7;

type Equivalents = Record<string, number>;

interface GeneratedEntry {
  dayIndex: number;
  mealSlot: string;
  recipeId: string;
}

function getDailyBudgets(): Record<string, number> {
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
export function generateMealPlanEntries(recipes: Recipe[], mealsPerDay: number): GeneratedEntry[] {
  const slotsKey = String(mealsPerDay) as keyof typeof dietRules.mealSlotsByMealsPerDay;
  const slots = dietRules.mealSlotsByMealsPerDay[slotsKey] || dietRules.mealSlotsByMealsPerDay["4"];
  const budgets = getDailyBudgets();

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

  const entries = generateMealPlanEntries(eligibleRecipes, mealsPerDay);

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
