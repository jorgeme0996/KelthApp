import cron from "node-cron";
import { prisma } from "../prisma";
import { startOfWeek } from "../lib/week";
import { dietIdForGoal } from "../lib/dietGoal";
import { generateAndSaveMealPlan } from "../services/mealPlanGenerator";
import { generateAndSaveRoutine } from "../services/routineGenerator";

const TIMEZONE = "America/Mexico_City";
const PLAN_EXPIRATION_HOUR = process.env.PLAN_EXPIRATION_HOUR ?? "0";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ROUTINE_VALIDITY_MS = 2 * WEEK_MS; // routines last 2 weeks, meal plans last 1

export interface RegenOptions {
  userId?: string;
  force?: boolean; // skip the expiration check, used by the manual test script
}

// Meal plans expire every week: once the calendar has moved past the plan's
// weekStart, generate a fresh one for the new week.
export async function regenerateExpiredMealPlans(options: RegenOptions = {}) {
  const currentWeekStart = startOfWeek(new Date());

  const users = await prisma.user.findMany({
    where: { mealPlans: { some: {} }, ...(options.userId ? { id: options.userId } : {}) },
  });

  for (const user of users) {
    try {
      const latestPlan = await prisma.mealPlan.findFirst({
        where: { userId: user.id },
        orderBy: { weekStart: "desc" },
      });
      if (!latestPlan) continue;

      const expired = latestPlan.weekStart.getTime() < currentWeekStart.getTime();
      if (!options.force && !expired) continue;

      console.log(`Generando nuevo menú semanal para ${user.id} (semana ${currentWeekStart.toISOString().slice(0, 10)})`);
      await generateAndSaveMealPlan(
        user.id,
        user.mealsPerDay,
        user.dietType,
        currentWeekStart,
        user.dietaryRestrictions,
        dietIdForGoal(user.goal),
      );
    } catch (err) {
      console.error(`Error generando menú semanal para ${user.id}:`, err);
    }
  }
}

// Routines expire every 2 weeks: once 14 days have passed since the routine's
// weekStart, generate a fresh one for the current week.
export async function regenerateExpiredRoutines(options: RegenOptions = {}) {
  const currentWeekStart = startOfWeek(new Date());

  const users = await prisma.user.findMany({
    where: { routines: { some: {} }, ...(options.userId ? { id: options.userId } : {}) },
  });

  for (const user of users) {
    try {
      const latestRoutine = await prisma.routine.findFirst({
        where: { userId: user.id },
        orderBy: { weekStart: "desc" },
      });
      if (!latestRoutine) continue;

      const expired = currentWeekStart.getTime() - latestRoutine.weekStart.getTime() >= ROUTINE_VALIDITY_MS;
      if (!options.force && !expired) continue;

      console.log(`Generando nueva rutina para ${user.id} (semana ${currentWeekStart.toISOString().slice(0, 10)})`);
      await generateAndSaveRoutine(
        user.id,
        user.exerciseDaysPerWeek ?? 3,
        currentWeekStart,
        user.trainingDays,
        user.splitType,
        user.equipmentPreference,
      );
    } catch (err) {
      console.error(`Error generando rutina para ${user.id}:`, err);
    }
  }
}

export function registerPlanExpirationCronJob() {
  cron.schedule(`5 ${PLAN_EXPIRATION_HOUR} * * *`, () => {
    regenerateExpiredMealPlans().catch((err) => console.error("Error en cron de expiración de menús:", err));
    regenerateExpiredRoutines().catch((err) => console.error("Error en cron de expiración de rutinas:", err));
  }, { timezone: TIMEZONE });

  console.log(`Cron job de expiración de menús/rutinas registrado (${PLAN_EXPIRATION_HOUR}:05 ${TIMEZONE})`);
}
