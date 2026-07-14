import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { stripe, priceIdForPlan, planForPriceId } from "../services/billing";
import Stripe from "stripe";

const router = Router();

const APP_SCHEME = process.env.APP_SCHEME || "kelth";

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "annual"]),
});

router.post("/checkout-session", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  try {
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceIdForPlan(parsed.data.plan), quantity: 1 }],
      success_url: `${APP_SCHEME}://billing/success`,
      cancel_url: `${APP_SCHEME}://billing/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/portal-session", authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!user.stripeCustomerId) {
    return res.status(404).json({ error: "Todavía no tienes una suscripción" });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_SCHEME}://billing/return`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

async function syncSubscriptionToUser(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn(`Stripe webhook: no user found for customer ${customerId}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: priceId ? planForPriceId(priceId) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    },
  });
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || typeof signature !== "string") {
    return res.status(400).json({ error: "Webhook mal configurado" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Firma inválida: ${(err as Error).message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToUser(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionToUser(subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Error procesando webhook de Stripe:", err);
  }

  res.status(200).json({ received: true });
}

export default router;
