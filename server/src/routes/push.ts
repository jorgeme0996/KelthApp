import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { isExpoPushToken } from "../services/pushNotifications";

const router = Router();

const registerSchema = z.object({
  token: z.string().refine(isExpoPushToken, "Token de push inválido"),
});

router.post("/register", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: { pushToken: parsed.data.token },
  });
  res.json({ ok: true });
});

router.post("/unregister", authMiddleware, async (req: AuthRequest, res) => {
  await prisma.user.update({
    where: { id: req.userId },
    data: { pushToken: null },
  });
  res.json({ ok: true });
});

export default router;
