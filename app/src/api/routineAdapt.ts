import { api } from "./client";
import { RoutineAdaptChatMessage, RoutineAdaptChatResponse, RoutineAdaptConfirmResponse, RoutineDayChange } from "@/types";

export function sendRoutineAdaptChat(routineId: string, messages: RoutineAdaptChatMessage[]) {
  return api.post<RoutineAdaptChatResponse>(`/api/routines/${routineId}/ai-adapt/chat`, { messages });
}

export function confirmRoutineAdapt(routineId: string, summary: string, dayChanges: RoutineDayChange[]) {
  return api.post<RoutineAdaptConfirmResponse>(`/api/routines/${routineId}/ai-adapt/confirm`, {
    adaptation: { summary, dayChanges },
  });
}
