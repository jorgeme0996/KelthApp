import { api } from "./client";
import { Exercise, Routine, RoutineEntry, WorkoutCompletion } from "@/types";

export function generateRoutine() {
  return api.post<Routine>("/api/routines/generate", {});
}

export function regenerateRoutineDay(routineId: string, dayIndex: number) {
  return api.post<Routine>("/api/routines/regenerate-day", { routineId, dayIndex });
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

export function completeWorkoutDay(routineId: string, dayIndex: number) {
  return api.post<WorkoutCompletion>("/api/routines/complete-day", { routineId, dayIndex });
}

export function uncompleteWorkoutDay(dayIndex: number) {
  return api.post<void>("/api/routines/uncomplete-day", { dayIndex });
}

export function getWorkoutCompletions() {
  return api.get<WorkoutCompletion[]>("/api/routines/completions");
}
