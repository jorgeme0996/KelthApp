import cron from "node-cron";
import { prisma } from "../prisma";
import { sendTrialEndingEmail } from "../services/mailer";

const TIMEZONE = "America/Mexico_City";
const APP_URL = process.env.APP_URL || "http://localhost:4000";
const REMINDER_HOUR = process.env.TRIAL_REMINDER_HOUR ?? "10";
const REMINDER_WINDOW_HOURS = 48; // avisar si la prueba termina dentro de las próximas 48h

async function sendTrialEndingReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      trialEndsAt: { gt: now, lte: windowEnd },
      stripeSubscriptionId: null,
      trialReminderSentAt: null,
    },
  });

  for (const user of users) {
    try {
      const daysLeft = Math.max(1, Math.ceil((user.trialEndsAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      await sendTrialEndingEmail(user.email, user.name, daysLeft, APP_URL);
      await prisma.user.update({ where: { id: user.id }, data: { trialReminderSentAt: now } });
    } catch (err) {
      console.error(`Error enviando recordatorio de fin de prueba a ${user.id}:`, err);
    }
  }
}

export function registerTrialReminderCronJob() {
  cron.schedule(`0 ${REMINDER_HOUR} * * *`, () => {
    sendTrialEndingReminders().catch((err) => console.error("Error en cron de recordatorio de prueba:", err));
  }, { timezone: TIMEZONE });

  console.log(`Cron job de recordatorio de fin de prueba registrado (${REMINDER_HOUR}:00 ${TIMEZONE})`);
}
