import { Router } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { buildSystemPrompt } from "../services/chatContext";
import { NUTRIOLOGOS } from "../data/nutriologos";

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const HISTORY_LIMIT = 20;

router.get("/history", authMiddleware, async (req: AuthRequest, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(messages);
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
});

router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "El asistente de IA no está configurado (falta ANTHROPIC_API_KEY)" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (user.dailyChatLimit != null) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayQuestionCount = await prisma.chatMessage.count({
      where: { userId: user.id, role: "user", createdAt: { gte: startOfDay } },
    });

    if (todayQuestionCount >= user.dailyChatLimit) {
      return res.status(429).json({
        error: "Si tienes más preguntas consulta con uno de nuestros nutriólogos",
        code: "DAILY_LIMIT_REACHED",
        nutriologos: NUTRIOLOGOS,
      });
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
  );

  await prisma.chatMessage.create({
    data: { userId: user.id, role: "user", content: parsed.data.message },
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
        { role: "user" as const, content: parsed.data.message },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    await prisma.chatMessage.create({
      data: { userId: user.id, role: "assistant", content: text },
    });

    res.json({ reply: text });
  } catch (err) {
    res.status(502).json({ error: "No se pudo contactar al asistente de IA", details: (err as Error).message });
  }
});

export default router;
