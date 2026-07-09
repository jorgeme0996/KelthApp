import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as routinesApi from "@/api/routines";
import { ApiError } from "@/api/client";

export function useCurrentRoutine() {
  return useQuery({
    queryKey: ["routine", "current"],
    queryFn: async () => {
      try {
        return await routinesApi.getCurrentRoutine();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useGenerateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => routinesApi.generateRoutine(),
    onSuccess: (data) => {
      queryClient.setQueryData(["routine", "current"], data);
    },
  });
}

export function useSwapRoutineEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => routinesApi.swapRoutineEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine", "current"] });
    },
  });
}
