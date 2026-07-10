import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { isPremium } from "../services/billing";
import { hasWeeklyActionRemaining } from "../services/usageLimits";

const router = Router();

// Read-only check so the client can gate entry into an AI swap chat flow
// before the user invests time in it, without spending any quota itself.
router.get("/weekly-status", authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const allowed = await hasWeeklyActionRemaining(user.id, isPremium(user));
  res.json({ allowed });
});

export default router;
