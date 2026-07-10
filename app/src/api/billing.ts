import { api } from "./client";

export function createCheckoutSession(plan: "monthly" | "annual") {
  return api.post<{ url: string }>("/api/billing/checkout-session", { plan });
}

export function createPortalSession() {
  return api.post<{ url: string }>("/api/billing/portal-session");
}

export function startTrial() {
  return api.post<{ trialEndsAt: string }>("/api/billing/start-trial");
}
