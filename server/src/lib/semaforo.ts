import { DietRules, getCategoryColors, getDietRules } from "../services/mealPlanGenerator";

export interface SemaforoEntry {
  category: string;
  color: string | null;
  label: string;
}

function getLabel(dietRules: DietRules, category: string): string {
  const moderate = dietRules.moderateEquivalents[category] as { label?: string } | undefined;
  if (moderate?.label) return moderate.label;
  const free = dietRules.free?.[category] as { label?: string } | undefined;
  if (free?.label) return free.label;
  return category;
}

// Clasifica los "equivalents" de una receta (ej. { proteinas: 1, cereales: 1 })
// según el semáforo de su dieta. `color` es null cuando la dieta todavía no
// tiene `semaforo` definido (hoy: lowcarb/maintenance, ver PENDIENTE en sus
// JSON) o la categoría no está asignada a ningún color — degradación segura,
// el cliente debe mostrar esas categorías sin color en vez de fallar.
export function classifyRecipeSemaforo(recipe: { dietType: string; equivalents: unknown }): SemaforoEntry[] {
  const dietRules = getDietRules(recipe.dietType);
  const categoryColors = getCategoryColors(dietRules);
  const equivalents = (recipe.equivalents ?? {}) as Record<string, number>;

  return Object.keys(equivalents).map((category) => ({
    category,
    color: categoryColors[category] ?? null,
    label: getLabel(dietRules, category),
  }));
}

export function withSemaforo<T extends { dietType: string; equivalents: unknown }>(
  recipe: T,
): T & { semaforo: SemaforoEntry[] } {
  return { ...recipe, semaforo: classifyRecipeSemaforo(recipe) };
}

// Igual que `withSemaforo` pero para un mealPlan con `entries[].recipe`
// anidado (forma que devuelven /api/mealplans/current, /generate, etc).
export function withSemaforoOnMealPlan<
  T extends { entries: { recipe: { dietType: string; equivalents: unknown } }[] },
>(mealPlan: T): T {
  return {
    ...mealPlan,
    entries: mealPlan.entries.map((entry) => ({ ...entry, recipe: withSemaforo(entry.recipe) })),
  };
}
