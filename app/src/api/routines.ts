import { api } from "./client";
import { Exercise, Routine, RoutineEntry } from "@/types";

export function generateRoutine() {
  return api.post<Routine>("/api/routines/generate", {});
}

export function getCurrentRoutine() {
  return api.get<Routine>("/api/routines/current");
}

export function swapRoutineEntry(entryId: string) {
  return api.post<RoutineEntry>(`/api/routines/entries/${entryId}/swap`, {});
}

export function getExercise(id: string) {
  return api.get<Exercise>(`/api/exercises/${id}`);
}
