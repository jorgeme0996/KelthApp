import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { runAssistantTurn } from "../services/assistant";

const router = Router();

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

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const result = await runAssistantTurn(user, parsed.data.message, "app");

  switch (result.status) {
    case "unavailable":
      return res.status(503).json({ error: "El asistente de IA no está configurado (falta ANTHROPIC_API_KEY)" });
    case "limited":
      return res.status(429).json({
        error: "Si tienes más preguntas consulta con uno de nuestros nutriólogos",
        code: "DAILY_LIMIT_REACHED",
        nutriologos: result.nutriologos,
      });
    case "error":
      return res.status(502).json({ error: "No se pudo contactar al asistente de IA", details: result.message });
    case "ok":
      return res.json({ reply: result.reply });
  }
});

export default router;
