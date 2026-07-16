import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { withSemaforo } from "../lib/semaforo";
import { dietIdForGoal } from "../lib/dietGoal";

const router = Router();

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const [recipe, user] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: req.params.id } }),
    prisma.user.findUnique({ where: { id: req.userId }, select: { goal: true } }),
  ]);
  if (!recipe) return res.status(404).json({ error: "Receta no encontrada" });
  res.json(withSemaforo(recipe, dietIdForGoal(user?.goal)));
});

export default router;
