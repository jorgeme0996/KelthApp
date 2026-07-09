import { api } from "./client";

export interface DietInfo {
  id: string;
  name: string;
  source: string;
  description: string;
  prohibited: Record<string, string[] | Record<string, unknown>>;
  free: Record<string, { label: string; items?: unknown; libres?: string[]; limitadas1xSemana?: string[] }>;
}

export function getDiet(dietId: string) {
  return api.get<DietInfo>(`/api/diets/${dietId}`);
}
