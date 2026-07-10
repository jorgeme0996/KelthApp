import { api } from "./client";
import { MealPlanEntry, MealSwapChatMessage, MealSwapChatResponse, MealSwapImage, MealSwapMode, RecipeDraft } from "@/types";

export function sendMealSwapChat(
  entryId: string,
  mode: MealSwapMode,
  messages: MealSwapChatMessage[],
  image?: MealSwapImage,
) {
  return api.post<MealSwapChatResponse>(`/api/mealplans/entries/${entryId}/ai-swap/chat`, { mode, messages, image });
}

export function confirmMealSwap(entryId: string, recipe: RecipeDraft) {
  return api.post<MealPlanEntry>(`/api/mealplans/entries/${entryId}/ai-swap/confirm`, { recipe });
}
