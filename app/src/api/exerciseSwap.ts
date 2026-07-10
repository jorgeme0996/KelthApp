import { api } from "./client";
import { ExerciseOption, ExerciseSwapChatMessage, ExerciseSwapChatResponse, ExerciseSwapMode, RoutineEntry } from "@/types";

export function sendExerciseSwapChat(entryId: string, mode: ExerciseSwapMode, messages: ExerciseSwapChatMessage[]) {
  return api.post<ExerciseSwapChatResponse>(`/api/routines/entries/${entryId}/ai-swap/chat`, { mode, messages });
}

export function confirmExerciseSwap(entryId: string, option: ExerciseOption) {
  return api.post<RoutineEntry>(`/api/routines/entries/${entryId}/ai-swap/confirm`, { option });
}
