import Anthropic from "@anthropic-ai/sdk";
import { User } from "@prisma/client";
import { prisma } from "../prisma";
import { buildSystemPrompt } from "./chatContext";
import { dietIdForGoal } from "../lib/dietGoal";
import { isPremium } from "./billing";
import { NUTRIOLOGOS } from "../data/nutriologos";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const HISTORY_LIMIT = 20;
const FREEMIUM_DAILY_CHAT_LIMIT = 5;

export type AssistantTurnResult =
  | { status: "ok"; reply: string }
  | { status: "limited"; nutriologos: typeof NUTRIOLOGOS }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export async function runAssistantTurn(
  user: User,
  message: string,
  channel: "app" | "whatsapp",
): Promise<AssistantTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unavailable" };
  }

  if (!isPremium(user)) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayQuestionCount = await prisma.chatMessage.count({
      where: { userId: user.id, role: "user", createdAt: { gte: startOfDay } },
    });

    const effectiveLimit = user.dailyChatLimit ?? FREEMIUM_DAILY_CHAT_LIMIT;
    if (todayQuestionCount >= effectiveLimit) {
      return { status: "limited", nutriologos: NUTRIOLOGOS };
    }
  }

  const [mealPlan, routine] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { entries: { include: { recipe: true } } },
    }),
    prisma.routine.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { entries: { include: { exercise: true } } },
    }),
  ]);

  // History is shared across channels: a user can start a thought in-app and
  // continue it over WhatsApp (or vice versa) and the assistant keeps context.
  const history = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const orderedHistory = history.reverse();

  const systemPrompt = buildSystemPrompt(
    user.mealsPerDay,
    mealPlan,
    routine,
    user.gender,
    user.splitType,
    user.equipmentPreference,
    user.dietaryRestrictions,
    dietIdForGoal(user.goal),
  );

  await prisma.chatMessage.create({
    data: { userId: user.id, role: "user", content: message, channel },
  });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...orderedHistory.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    await prisma.chatMessage.create({
      data: { userId: user.id, role: "assistant", content: text, channel },
    });

    return { status: "ok", reply: text };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
