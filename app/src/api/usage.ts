import { api } from "./client";

export function getWeeklyUsageStatus() {
  return api.get<{ allowed: boolean }>("/api/usage/weekly-status");
}
