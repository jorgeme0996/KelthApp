import { ApiError } from "@/api/client";
import { WeeklyLimitError } from "@/types";

export function isWeeklyLimitError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && (err.data as WeeklyLimitError | undefined)?.code === "WEEKLY_ACTION_LIMIT_REACHED";
}
