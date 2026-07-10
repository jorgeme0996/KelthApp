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

// Read-only peek at the same weekly counter, used to gate entry into an AI
// swap chat flow *before* the user spends time on it (the chat itself is
// free — only confirming a swap consumes the quota via the function above).
export async function hasWeeklyActionRemaining(userId: string, premium: boolean): Promise<boolean> {
  if (premium) return true;

  const weekStart = startOfWeek(new Date());
  const usage = await prisma.weeklyActionUsage.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });

  return (usage?.count ?? 0) < FREEMIUM_WEEKLY_ACTION_LIMIT;
}
