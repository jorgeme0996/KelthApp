import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as mealplansApi from "@/api/mealplans";
import { ApiError } from "@/api/client";
import { MealPlan } from "@/types";

export function useCurrentMealPlan() {
  return useQuery({
    queryKey: ["mealplan", "current"],
    queryFn: async () => {
      try {
        return await mealplansApi.getCurrentMealPlan();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useGenerateMealPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mealplansApi.generateMealPlan(),
    onSuccess: (data) => {
      queryClient.setQueryData(["mealplan", "current"], data);
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });
}

export function useRegenerateMealPlanDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealPlanId, dayIndex }: { mealPlanId: string; dayIndex: number }) =>
      mealplansApi.regenerateMealPlanDay(mealPlanId, dayIndex),
    onSuccess: (data) => {
      queryClient.setQueryData(["mealplan", "current"], data);
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });
}

export function useSwapMealEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => mealplansApi.swapMealEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealplan", "current"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });
}

export function useToggleMealEntryComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => mealplansApi.toggleMealEntryComplete(entryId),
    onSuccess: (updatedEntry) => {
      queryClient.setQueryData<MealPlan | null | undefined>(["mealplan", "current"], (current) => {
        if (!current) return current;
        return {
          ...current,
          entries: current.entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)),
        };
      });
    },
  });
}

export function useShoppingList(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ["shoppingList", mealPlanId],
    queryFn: () => mealplansApi.getShoppingList(mealPlanId as string),
    enabled: !!mealPlanId,
  });
}
