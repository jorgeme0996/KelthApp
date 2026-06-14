import { prisma } from "../prisma";

interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  category: string;
}

export interface ShoppingListItem {
  name: string;
  unit: string;
  qty: number;
  category: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  verduras: "Verduras y frutas",
  frutas: "Verduras y frutas",
  tuberculos: "Verduras y frutas",
  proteinas: "Carnes, pescados y huevo",
  embutidos: "Carnes, pescados y huevo",
  lacteos: "Lácteos y quesos",
  cereales: "Cereales y panadería",
  leguminosas: "Leguminosas",
  oleaginosas: "Oleaginosas y semillas",
  grasas: "Aceites y grasas",
  despensa: "Despensa, salsas y especias",
};

/**
 * Aggregates ingredients across all entries of a meal plan, summing
 * quantities per (name, unit) and grouping them by supermarket-style section.
 */
export async function buildShoppingList(mealPlanId: string): Promise<Record<string, ShoppingListItem[]>> {
  const entries = await prisma.mealPlanEntry.findMany({
    where: { mealPlanId },
    include: { recipe: true },
  });

  const totals = new Map<string, ShoppingListItem>();

  for (const entry of entries) {
    const ingredients = (entry.recipe.ingredients as unknown as Ingredient[]) || [];
    for (const ing of ingredients) {
      const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
      const existing = totals.get(key);
      if (existing) {
        existing.qty += ing.qty;
      } else {
        totals.set(key, { name: ing.name, unit: ing.unit, qty: ing.qty, category: ing.category });
      }
    }
  }

  const grouped: Record<string, ShoppingListItem[]> = {};
  for (const item of totals.values()) {
    const sectionLabel = CATEGORY_LABELS[item.category] || "Otros";
    if (!grouped[sectionLabel]) grouped[sectionLabel] = [];
    item.qty = Math.round(item.qty * 100) / 100;
    grouped[sectionLabel].push(item);
  }

  for (const section of Object.values(grouped)) {
    section.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  return grouped;
}
