import cron from "node-cron";
import { prisma } from "../prisma";
import { User } from "@prisma/client";
import { isPremium } from "../services/billing";
import { sendPushNotification } from "../services/pushNotifications";
import { getMexicoCityToday } from "../lib/timezone";

const TIMEZONE = "America/Mexico_City";
const APP_SCHEME = process.env.APP_SCHEME || "elmejormenu";

const BREAKFAST_HOUR = process.env.PUSH_BREAKFAST_REMINDER_HOUR ?? "8";
const LUNCH_HOUR = process.env.PUSH_LUNCH_REMINDER_HOUR ?? "14";
const EVENING_HOUR = process.env.PUSH_EVENING_REMINDER_HOUR ?? "20";

// `force` skips the premium/already-completed checks so a single reminder
// can be triggered on demand (see src/scripts/testPushReminder.ts) without
// needing a premium test account with pending tasks.
export interface ReminderOptions {
  userId?: string;
  force?: boolean;
}

async function getPremiumUsersWithPushToken(options: ReminderOptions = {}): Promise<(User & { pushToken: string })[]> {
  const users = await prisma.user.findMany({
    where: { pushToken: { not: null }, ...(options.userId ? { id: options.userId } : {}) },
  });
  return users.filter((u): u is User & { pushToken: string } => Boolean(u.pushToken) && (options.force || isPremium(u)));
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

async function runForEachUser(users: (User & { pushToken: string })[], handler: (user: User & { pushToken: string }) => Promise<void>) {
  for (const user of users) {
    try {
      await handler(user);
    } catch (err) {
      console.error(`Error enviando push a ${user.id}:`, err);
      // Expo marks tokens from uninstalled apps as DeviceNotRegistered — stop
      // retrying that device instead of erroring on every future cron run.
      if (err instanceof Error && err.message.includes("DeviceNotRegistered")) {
        await prisma.user.update({ where: { id: user.id }, data: { pushToken: null } }).catch(() => {});
      }
    }
  }
}

export async function sendBreakfastReminders(options: ReminderOptions = {}) {
  const { dayIndex } = getMexicoCityToday();
  const users = await getPremiumUsersWithPushToken(options);

  await runForEachUser(users, async (user) => {
    const mealPlan = await getLatestMealPlanWithEntries(user.id);
    const entry = mealPlan?.entries.find((e) => e.dayIndex === dayIndex && e.mealSlot === "desayuno");
    if (!options.force && (!entry || entry.completedAt)) return;
    console.log(`Enviando recordatorio de desayuno (push) a ${user.id}...`);
    await sendPushNotification(
      user.pushToken,
      "¡Buenos días! 🍳",
      `${user.name}, no olvides registrar tu desayuno de hoy.`,
      { url: `${APP_SCHEME}://(tabs)/menu` },
    );
  });
}

export async function sendLunchAndRoutineReminders(options: ReminderOptions = {}) {
  const { dayIndex, startOfDay, endOfDay } = getMexicoCityToday();
  const users = await getPremiumUsersWithPushToken(options);

  await runForEachUser(users, async (user) => {
    const [mealPlan, routine] = await Promise.all([
      getLatestMealPlanWithEntries(user.id),
      getLatestRoutineWithEntries(user.id),
    ]);

    const comidaEntry = mealPlan?.entries.find((e) => e.dayIndex === dayIndex && e.mealSlot === "comida");
    const mealStatusText = !comidaEntry || comidaEntry.completedAt
      ? "¡Ya registraste tu comida, sigue así!"
      : "Aún no has registrado tu comida de hoy.";

    const todaysRoutineEntries = routine?.entries.filter((e) => e.dayIndex === dayIndex) ?? [];
    let workoutStatusText: string;
    if (todaysRoutineEntries.length === 0) {
      workoutStatusText = "Hoy es tu día de descanso, aprovecha para relajarte.";
    } else {
      const completion = await prisma.workoutCompletion.findFirst({
        where: { userId: user.id, dayIndex, completedAt: { gte: startOfDay, lt: endOfDay } },
      });
      workoutStatusText = completion
        ? "¡Ya completaste tu entrenamiento de hoy, felicidades!"
        : "Todavía te toca entrenar hoy.";
    }

    await sendPushNotification(
      user.pushToken,
      "Tu avance de hoy",
      `${mealStatusText} ${workoutStatusText}`,
      { url: `${APP_SCHEME}://(tabs)/menu` },
    );
  });
}

export async function sendEveningWrapUp(options: ReminderOptions = {}) {
  const { dayIndex, startOfDay, endOfDay } = getMexicoCityToday();
  const users = await getPremiumUsersWithPushToken(options);

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
        "Puede que hayas cumplido tus comidas o tu entrenamiento y no lo hayas anotado en la app, o simplemente hoy no se pudo — hay días así y no pasa nada.";
    }

    await sendPushNotification(
      user.pushToken,
      "Resumen de tu día",
      statusText,
      { url: `${APP_SCHEME}://(tabs)/profile` },
    );
  });
}

export function registerPushCronJobs() {
  cron.schedule(`0 ${BREAKFAST_HOUR} * * *`, () => {
    sendBreakfastReminders().catch((err) => console.error("Error en cron de desayuno:", err));
  }, { timezone: TIMEZONE });

  cron.schedule(`0 ${LUNCH_HOUR} * * *`, () => {
    sendLunchAndRoutineReminders().catch((err) => console.error("Error en cron de comida/rutina:", err));
  }, { timezone: TIMEZONE });

  cron.schedule(`0 ${EVENING_HOUR} * * *`, () => {
    sendEveningWrapUp().catch((err) => console.error("Error en cron de resumen nocturno:", err));
  }, { timezone: TIMEZONE });

  console.log(`Cron jobs de push registrados (${BREAKFAST_HOUR}:00 / ${LUNCH_HOUR}:00 / ${EVENING_HOUR}:00 ${TIMEZONE})`);
}
