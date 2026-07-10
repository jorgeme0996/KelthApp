import { prisma } from "../prisma";
import { startOfWeek } from "../lib/week";

const FREEMIUM_WEEKLY_ACTION_LIMIT = Number(process.env.FREEMIUM_WEEKLY_ACTION_LIMIT ?? 5);

// Freemium cap on regenerate-day / swap actions across meal plans and
// routines, combined into a single weekly counter. Premium users always pass.
export async function checkAndConsumeWeeklyAction(userId: string, premium: boolean): Promise<{ allowed: boolean }> {
  if (premium) return { allowed: true };

  const weekStart = startOfWeek(new Date());
  const usage = await prisma.weeklyActionUsage.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: { userId, weekStart, count: 0 },
    update: {},
  });

  if (usage.count >= FREEMIUM_WEEKLY_ACTION_LIMIT) return { allowed: false };

  await prisma.weeklyActionUsage.update({ where: { id: usage.id }, data: { count: { increment: 1 } } });
  return { allowed: true };
}
