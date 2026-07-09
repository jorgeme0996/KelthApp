import { api } from "./client";
import { MealPlan, MealPlanEntry, Recipe, ShoppingListResponse } from "@/types";

export function generateMealPlan() {
  return api.post<MealPlan>("/api/mealplans/generate", {});
}

export function getCurrentMealPlan() {
  return api.get<MealPlan>("/api/mealplans/current");
}

export function getShoppingList(mealPlanId: string) {
  return api.get<ShoppingListResponse>(`/api/mealplans/${mealPlanId}/shopping-list`);
}

export function swapMealEntry(entryId: string) {
  return api.post<MealPlanEntry>(`/api/mealplans/entries/${entryId}/swap`, {});
}

export function toggleMealEntryComplete(entryId: string) {
  return api.post<MealPlanEntry>(`/api/mealplans/entries/${entryId}/complete`, {});
}

export function getRecipe(id: string) {
  return api.get<Recipe>(`/api/recipes/${id}`);
}
