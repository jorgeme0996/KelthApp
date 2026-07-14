import { ApiError } from "@/api/client";
import { PremiumRequiredError } from "@/types";

export function isPremiumRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && (err.data as PremiumRequiredError | undefined)?.code === "PREMIUM_REQUIRED";
}
