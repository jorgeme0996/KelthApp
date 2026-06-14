import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateAndSaveMealPlan } from "../services/mealPlanGenerator";
import { buildShoppingList } from "../services/shoppingList";

const router = Router();

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const generateSchema = z.object({
  weekStart: z.string().datetime().optional(),
});

router.post("/generate", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const weekStart = parsed.data.weekStart ? startOfWeek(new Date(parsed.data.weekStart)) : startOfWeek(new Date());

  try {
    const mealPlan = await generateAndSaveMealPlan(user.id, user.mealsPerDay, user.dietType, weekStart);
    res.status(201).json(mealPlan);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/current", authMiddleware, async (req: AuthRequest, res) => {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { entries: { include: { recipe: true } } },
  });
  if (!mealPlan) return res.status(404).json({ error: "Aún no tienes un menú generado" });
  res.json(mealPlan);
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { entries: { include: { recipe: true } } },
  });
  if (!mealPlan) return res.status(404).json({ error: "Menú no encontrado" });
  res.json(mealPlan);
});

router.get("/:id/shopping-list", authMiddleware, async (req: AuthRequest, res) => {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!mealPlan) return res.status(404).json({ error: "Menú no encontrado" });

  const list = await buildShoppingList(mealPlan.id);
  res.json({ mealPlanId: mealPlan.id, sections: list });
});

const swapSchema = z.object({
  recipeId: z.string().uuid().optional(),
});

// Swap a single meal-plan entry for another recipe that fits the same slot
router.post("/entries/:entryId/swap", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = swapSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: req.params.entryId },
    include: { mealPlan: true, recipe: true },
  });
  if (!entry || entry.mealPlan.userId !== req.userId) {
    return res.status(404).json({ error: "Comida no encontrada" });
  }

  let newRecipeId = parsed.data.recipeId;
  if (!newRecipeId) {
    const candidates = await prisma.recipe.findMany({
      where: {
        dietType: entry.recipe.dietType,
        mealSlots: { has: entry.mealSlot },
        NOT: { id: entry.recipeId },
      },
    });
    if (candidates.length === 0) return res.status(404).json({ error: "No hay alternativas disponibles" });
    newRecipeId = candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  const updated = await prisma.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId: newRecipeId },
    include: { recipe: true },
  });

  res.json(updated);
});

export default router;
