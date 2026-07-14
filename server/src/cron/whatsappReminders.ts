import cron from "node-cron";
import { prisma } from "../prisma";
import { User } from "@prisma/client";
import { isPremium } from "../services/billing";
import { sendTemplateMessage } from "../services/zernio";
import { getMexicoCityToday } from "../lib/timezone";
import { toE164 } from "../lib/phone";

const TIMEZONE = "America/Mexico_City";
// WhatsApp only renders http(s) URLs as tappable links, not custom schemes,
// so reminders point at the /go/* https redirector (see routes/deepLink.ts)
// instead of a raw `${APP_SCHEME}://...` link.
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;

const TEMPLATE_BREAKFAST = process.env.ZERNIO_TEMPLATE_BREAKFAST || "desayuno_recordatorio";
const TEMPLATE_LUNCH = process.env.ZERNIO_TEMPLATE_LUNCH || "comida_rutina_recordatorio";
const TEMPLATE_EVENING = process.env.ZERNIO_TEMPLATE_EVENING || "resumen_noche";

const BREAKFAST_HOUR = process.env.WHATSAPP_BREAKFAST_REMINDER_HOUR ?? "8";
const LUNCH_HOUR = process.env.WHATSAPP_LUNCH_REMINDER_HOUR ?? "14";
const EVENING_HOUR = process.env.WHATSAPP_EVENING_REMINDER_HOUR ?? "20";

// `force` skips the premium/already-completed checks so a single reminder
// can be triggered on demand (see src/scripts/testWhatsappReminder.ts)
// without needing a premium test account with pending tasks.
export interface ReminderOptions {
  userId?: string;
  force?: boolean;
}

async function getPremiumUsersWithPhone(options: ReminderOptions = {}): Promise<(User & { phone: string })[]> {
  const users = await prisma.user.findMany({
    where: { phone: { not: null }, ...(options.userId ? { id: options.userId } : {}) },
  });
  return users
    .filter((u): u is User & { phone: string } => Boolean(u.phone) && (options.force || isPremium(u)))
    .flatMap((u) => {
      const e164 = toE164(u.phone);
      return e164 ? [{ ...u, phone: e164 }] : [];
    });
}

async function getLatestMealPlanWithEntries(userId: string) {
  return prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { entries: true },
  });
}

async function getLatestRoutineWithEntries(userId: string) {
  return prisma.routine.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { entries: true },
  });
}

async function runForEachUser(users: (User & { phone: string })[], handler: (user: User & { phone: string }) => Promise<void>) {
  for (const user of users) {
    try {
      await handler(user);
    } catch (err) {
      console.error(`Error enviando recordatorio de WhatsApp a ${user.id}:`, err);
    }
  }
}

export async function sendBreakfastReminders(options: ReminderOptions = {}) {
  const { dayIndex } = getMexicoCityToday();
  const users = await getPremiumUsersWithPhone(options);

  await runForEachUser(users, async (user) => {
    const mealPlan = await getLatestMealPlanWithEntries(user.id);
    const entry = mealPlan?.entries.find((e) => e.dayIndex === dayIndex && e.mealSlot === "desayuno");
    if (!options.force && (!entry || entry.completedAt)) return;
    console.log(`Enviando recordatorio de desayuno a ${user.phone}...`);
    await sendTemplateMessage(user.phone, TEMPLATE_BREAKFAST, [
      user.name,
      `${APP_URL}/go/menu`,
    ]);
  });
}

export async function sendLunchAndRoutineReminders(options: ReminderOptions = {}) {
  const { dayIndex, startOfDay, endOfDay } = getMexicoCityToday();
  const users = await getPremiumUsersWithPhone(options);

  await runForEachUser(users, async (user) => {
    const [mealPlan, routine] = await Promise.all([
      getLatestMealPlanWithEntries(user.id),
      getLatestRoutineWithEntries(user.id),
    ]);

    const comidaEntry = mealPlan?.entries.find((e) => e.dayIndex === dayIndex && e.mealSlot === "comida");
    const mealStatusText = !comidaEntry || comidaEntry.completedAt
      ? "¡Ya registraste tu comida, sigue así!"
      : `Aún no has registrado tu comida de hoy. Ábrela aquí: ${APP_URL}/go/menu`;

    const todaysRoutineEntries = routine?.entries.filter((e) => e.dayIndex === dayIndex) ?? [];
    let workoutStatusText: string;
    if (todaysRoutineEntries.length === 0) {
      workoutStatusText = "Hoy es tu día de descanso, aprovecha para relajarte: descansar tus músculos también es parte del progreso.";
    } else {
      const completion = await prisma.workoutCompletion.findFirst({
        where: { userId: user.id, dayIndex, completedAt: { gte: startOfDay, lt: endOfDay } },
      });
      workoutStatusText = completion
        ? "¡Ya completaste tu entrenamiento de hoy, felicidades!"
        : `Todavía te toca entrenar hoy. Mira tu rutina aquí: ${APP_URL}/go/exercise`;
    }

    await sendTemplateMessage(user.phone, TEMPLATE_LUNCH, [user.name, mealStatusText, workoutStatusText]);
  });
}

export async function sendEveningWrapUp(options: ReminderOptions = {}) {
  const { dayIndex, startOfDay, endOfDay } = getMexicoCityToday();
  const users = await getPremiumUsersWithPhone(options);

  await runForEachUser(users, async (user) => {
    const [mealPlan, routine] = await Promise.all([
      getLatestMealPlanWithEntries(user.id),
      getLatestRoutineWithEntries(user.id),
    ]);

    const todaysMealEntries = mealPlan?.entries.filter((e) => e.dayIndex === dayIndex) ?? [];
    const allMealsDone = todaysMealEntries.length > 0 && todaysMealEntries.every((e) => e.completedAt != null);

    const todaysRoutineEntries = routine?.entries.filter((e) => e.dayIndex === dayIndex) ?? [];
    const isRestDay = todaysRoutineEntries.length === 0;

    let workoutDone = isRestDay;
    if (!isRestDay) {
      const completion = await prisma.workoutCompletion.findFirst({
        where: { userId: user.id, dayIndex, completedAt: { gte: startOfDay, lt: endOfDay } },
      });
      workoutDone = Boolean(completion);
    }

    let statusText: string;
    if (allMealsDone && workoutDone) {
      statusText = isRestDay
        ? "Cumpliste con tus comidas y hoy tocaba descansar. ¡Excelente día!"
        : "Cumpliste con tus comidas y tu entrenamiento. ¡Felicidades, así se hace!";
    } else {
      statusText =
        "Puede que hayas cumplido tus comidas o tu entrenamiento y no lo hayas anotado en la app, o simplemente hoy no se pudo — hay días así y no pasa nada. " +
        `Si quieres, puedes reconfigurar tus días de entreno desde tu perfil: ${APP_URL}/go/profile`;
    }

    await sendTemplateMessage(user.phone, TEMPLATE_EVENING, [user.name, statusText]);
  });
}

export function registerWhatsappCronJobs() {
  cron.schedule(`0 ${BREAKFAST_HOUR} * * *`, () => {
    sendBreakfastReminders().catch((err) => console.error("Error en cron de desayuno:", err));
  }, { timezone: TIMEZONE });

  cron.schedule(`0 ${LUNCH_HOUR} * * *`, () => {
    sendLunchAndRoutineReminders().catch((err) => console.error("Error en cron de comida/rutina:", err));
  }, { timezone: TIMEZONE });

  cron.schedule(`0 ${EVENING_HOUR} * * *`, () => {
    sendEveningWrapUp().catch((err) => console.error("Error en cron de resumen nocturno:", err));
  }, { timezone: TIMEZONE });

  console.log(`Cron jobs de WhatsApp registrados (${BREAKFAST_HOUR}:00 / ${LUNCH_HOUR}:00 / ${EVENING_HOUR}:00 ${TIMEZONE})`);
}
