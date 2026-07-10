import crypto from "crypto";
import Zernio from "@zernio/node";

const zernio = new Zernio();
const ACCOUNT_ID = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID || "";

// Business-initiated messages (our 3 cron reminders) must use a pre-approved
// WhatsApp template — Meta doesn't allow freeform messages to open a
// conversation. This also re-engages a contact after the 24h window closes.
export async function sendTemplateMessage(
  toE164: string,
  templateName: string,
  templateParams: string[] = [],
): Promise<void> {
  console.log(`Zernio sendTemplateMessage: to=${toE164}, template=${templateName}, params=${JSON.stringify(templateParams)}`);
  const { error } = await zernio.messages.createInboxConversation({
    body: {
      accountId: ACCOUNT_ID,
      participantId: toE164.replace(/^\+/, ""),
      templateName,
      templateLanguage: "es_MX",
      templateParams,
    },
  });
  console.log(`Zernio createInboxConversation: to=${toE164}, template=${templateName}, params=${JSON.stringify(templateParams)}, error=${JSON.stringify(error)}`);
  if (error) throw new Error(`Zernio createInboxConversation failed: ${JSON.stringify(error)}`);
}

// Freeform reply within an open 24h conversation window (e.g. replying to an
// inbound WhatsApp message from the assistant webhook).
export async function sendFreeformMessage(conversationId: string, text: string): Promise<void> {
  const { error } = await zernio.messages.sendInboxMessage({
    path: { conversationId },
    body: { accountId: ACCOUNT_ID, message: text },
  });
  if (error) throw new Error(`Zernio sendInboxMessage failed: ${JSON.stringify(error)}`);
}

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
