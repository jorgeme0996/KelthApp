import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/:id", authMiddleware, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
  if (!recipe) return res.status(404).json({ error: "Receta no encontrada" });
  res.json(recipe);
});

export default router;
