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
// según el semáforo de la dieta del USUARIO que la está viendo (`dietId`,
// derivado de su `goal` — ver server/src/lib/dietGoal.ts). No se usa
// `recipe.dietType`: ese campo solo indica de qué catálogo salió la receta
// (hoy todas son "lowcarb", ver mealPlanGenerator.ts), no la dieta que el
// usuario está siguiendo — dos personas con goals distintos pueden ver la
// misma receta y deben ver colores distintos. `color` es null cuando la
// dieta del usuario todavía no tiene `semaforo` definido (hoy: maintenance,
// ver PENDIENTE en su JSON) o la categoría no está asignada a ningún color —
// degradación segura, el cliente debe mostrar esas categorías sin color en
// vez de fallar.
export function classifyRecipeSemaforo(recipe: { equivalents: unknown }, dietId: string): SemaforoEntry[] {
  const dietRules = getDietRules(dietId);
  const categoryColors = getCategoryColors(dietRules);
  const equivalents = (recipe.equivalents ?? {}) as Record<string, number>;

  return Object.keys(equivalents).map((category) => ({
    category,
    color: categoryColors[category] ?? null,
    label: getLabel(dietRules, category),
  }));
}

export function withSemaforo<T extends { equivalents: unknown }>(
  recipe: T,
  dietId: string,
): T & { semaforo: SemaforoEntry[] } {
  return { ...recipe, semaforo: classifyRecipeSemaforo(recipe, dietId) };
}

// Igual que `withSemaforo` pero para un mealPlan con `entries[].recipe`
// anidado (forma que devuelven /api/mealplans/current, /generate, etc).
export function withSemaforoOnMealPlan<T extends { entries: { recipe: { equivalents: unknown } }[] }>(
  mealPlan: T,
  dietId: string,
): T {
  return {
    ...mealPlan,
    entries: mealPlan.entries.map((entry) => ({ ...entry, recipe: withSemaforo(entry.recipe, dietId) })),
  };
}
