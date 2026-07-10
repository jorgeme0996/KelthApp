import { Router } from "express";
import express from "express";
import { prisma } from "../prisma";
import { isPremium } from "../services/billing";
import { runAssistantTurn } from "../services/assistant";
import { sendFreeformMessage, verifyWebhookSignature } from "../services/zernio";
import { toE164 } from "../lib/phone";

const router = Router();

interface WebhookPayload {
  id: string;
  event: string;
  message?: {
    conversationId: string;
    text: string | null;
    sender: { phoneNumber?: string | null };
  };
}

async function findUserByPhone(e164: string) {
  const candidates = await prisma.user.findMany({ where: { phone: { not: null } } });
  return candidates.find((u) => u.phone && toE164(u.phone) === e164) ?? null;
}

async function processInboundMessage(payload: WebhookPayload) {
  const message = payload.message;
  if (!message || !message.text) return; // ignore non-text messages for MVP

  const senderPhone = message.sender.phoneNumber;
  if (!senderPhone) return; // can't identify sender without a phone number

  const normalizedSender = toE164(senderPhone);
  if (!normalizedSender) return;

  const user = await findUserByPhone(normalizedSender);
  if (!user) {
    console.warn(`WhatsApp webhook: no user matched phone ${normalizedSender}`);
    return;
  }

  if (!isPremium(user)) {
    await sendFreeformMessage(
      message.conversationId,
      "El asistente por WhatsApp es una función Premium. Actualiza tu plan desde la app para desbloquearlo.",
    );
    return;
  }

  const result = await runAssistantTurn(user, message.text, "whatsapp");
  if (result.status === "ok") {
    await sendFreeformMessage(message.conversationId, result.reply);
  } else {
    await sendFreeformMessage(
      message.conversationId,
      "No pude procesar tu mensaje en este momento, intenta de nuevo en unos minutos.",
    );
  }
}

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook no configurado" });

  const signature = req.headers["x-zernio-signature"];
  const rawBody = req.body as Buffer;
  if (!verifyWebhookSignature(rawBody, typeof signature === "string" ? signature : undefined, secret)) {
    return res.status(401).json({ error: "Firma inválida" });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "JSON inválido" });
  }

  if (!payload.id || !payload.event) {
    return res.status(400).json({ error: "Payload inválido" });
  }

  try {
    await prisma.whatsappWebhookEvent.create({ data: { id: payload.id, eventType: payload.event } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      // Already processed — Zernio's at-least-once delivery, ack without reprocessing.
      return res.status(200).json({ ok: true });
    }
    console.error("Error registrando evento de webhook de WhatsApp:", err);
    return res.status(500).json({ error: "Error interno" });
  }

  // Ack immediately (Zernio expects 2xx within 5s); process the Claude call
  // and reply asynchronously so a slow model response doesn't trigger retries.
  res.status(200).json({ ok: true });

  if (payload.event === "message.received") {
    processInboundMessage(payload).catch((err) => {
      console.error("Error procesando mensaje entrante de WhatsApp:", err);
    });
  }
});

export default router;
