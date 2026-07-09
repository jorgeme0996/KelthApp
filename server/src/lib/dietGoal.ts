export const GOALS = ["bajar_peso", "mantener_peso", "subir_masa"] as const;
export type Goal = (typeof GOALS)[number];

const DIET_ID_BY_GOAL: Record<Goal, string> = {
  bajar_peso: "lowcarb",
  mantener_peso: "maintenance",
  subir_masa: "muscle-gain",
};

// El objetivo del usuario determina qué presupuestos de equivalentes/porciones
// (dietRules) se usan para armar el menú; el catálogo de recetas sigue siendo
// el mismo (lowcarb mexicano) hasta que existan recetas propias por dieta.
export function dietIdForGoal(goal: string | null | undefined): string {
  if (goal && goal in DIET_ID_BY_GOAL) return DIET_ID_BY_GOAL[goal as Goal];
  return DIET_ID_BY_GOAL.bajar_peso;
}
