import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const ACTIVE_STATUSES = ["active", "trialing"];

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 7);

export function isPremium(user: {
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
}): boolean {
  if (user.trialEndsAt && user.trialEndsAt > new Date()) return true;
  if (!user.subscriptionStatus || !ACTIVE_STATUSES.includes(user.subscriptionStatus)) return false;
  if (user.currentPeriodEnd && user.currentPeriodEnd < new Date()) return false;
  return true;
}

export function priceIdForPlan(plan: "monthly" | "annual"): string {
  const priceId = plan === "monthly" ? process.env.STRIPE_PRICE_ID_MONTHLY : process.env.STRIPE_PRICE_ID_ANNUAL;
  if (!priceId) throw new Error(`Falta configurar el price id de Stripe para el plan ${plan}`);
  return priceId;
}

export function planForPriceId(priceId: string): "monthly" | "annual" | null {
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_ID_ANNUAL) return "annual";
  return null;
}
