import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware } from "../middleware/auth";
import { withExerciseMediaUrls } from "../lib/media";

const router = Router();

router.get("/:id", authMiddleware, async (req, res) => {
  const exercise = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!exercise) return res.status(404).json({ error: "Ejercicio no encontrado" });
  res.json(withExerciseMediaUrls(exercise));
});

export default router;
