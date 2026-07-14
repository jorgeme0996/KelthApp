import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateAndSaveMealPlan, regenerateMealPlanDay } from "../services/mealPlanGenerator";
import { buildShoppingList } from "../services/shoppingList";
import { startOfWeek } from "../lib/week";
import { dietIdForGoal } from "../lib/dietGoal";
import { computeMuscleGainTier } from "../lib/comodinTier";
import { isPremium } from "../services/billing";
import { recipeDraftSchema, runMealSwapChatTurn } from "../services/mealSwapAssistant";
import { withSemaforo, withSemaforoOnMealPlan } from "../lib/semaforo";

const PREMIUM_REQUIRED_ERROR = {
  error: "Esta función requiere Premium.",
  code: "PREMIUM_REQUIRED",
};

const router = Router();

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
    const mealPlan = await generateAndSaveMealPlan(
      user.id,
      user.mealsPerDay,
      user.dietType,
      weekStart,
      user.dietaryRestrictions,
      dietIdForGoal(user.goal),
      computeMuscleGainTier(user.heightCm, user.weightKg),
    );
    res.status(201).json(withSemaforoOnMealPlan(mealPlan));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const regenerateDaySchema = z.object({
  mealPlanId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

// Regenerate a single day's meals in-place, leaving the rest of the week untouched.
router.post("/regenerate-day", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = regenerateDaySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: parsed.data.mealPlanId, userId: req.userId },
  });
  if (!mealPlan) return res.status(404).json({ error: "Menú no encontrado" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  try {
    const updated = await regenerateMealPlanDay(
      mealPlan.id,
      parsed.data.dayIndex,
      mealPlan.mealsPerDay,
      user.dietType,
      user.dietaryRestrictions,
      dietIdForGoal(user.goal),
      computeMuscleGainTier(user.heightCm, user.weightKg),
    );
    res.json(withSemaforoOnMealPlan(updated));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/current", authMiddleware, async (req: AuthRequest, res) => {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { entries: { include: { recipe: true } } },
  });
  if (!mealPlan) return res.status(404).json({ error: "Aún no tienes un menú generado" });
  res.json(withSemaforoOnMealPlan(mealPlan));
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { entries: { include: { recipe: true } } },
  });
  if (!mealPlan) return res.status(404).json({ error: "Menú no encontrado" });
  res.json(withSemaforoOnMealPlan(mealPlan));
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

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

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

  res.json({ ...updated, recipe: withSemaforo(updated.recipe) });
});

const MAX_CHAT_TURNS = 12;
const MAX_IMAGE_BASE64_CHARS = 7_000_000; // ~5MB raw

const aiSwapChatSchema = z.object({
  mode: z.enum(["fridge", "restaurant_options", "menu_photo"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(MAX_CHAT_TURNS),
  image: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      dataBase64: z.string().max(MAX_IMAGE_BASE64_CHARS),
    })
    .optional(),
});

// Conversational turn of the AI meal-swap flow (fridge / restaurant options / menu photo).
// Stateless: the client resends the running message array each turn; nothing is persisted here.
router.post("/entries/:entryId/ai-swap/chat", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = aiSwapChatSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  if (parsed.data.image && parsed.data.mode !== "menu_photo") {
    return res.status(400).json({ error: "La imagen solo aplica al modo de foto de menú" });
  }

  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: req.params.entryId },
    include: { mealPlan: true, recipe: true },
  });
  if (!entry || entry.mealPlan.userId !== req.userId) {
    return res.status(404).json({ error: "Comida no encontrada" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  const result = await runMealSwapChatTurn(
    parsed.data.mode,
    entry.mealSlot,
    entry.recipe.name,
    parsed.data.messages,
    parsed.data.image,
    dietIdForGoal(user.goal),
  );

  if (result.status === "unavailable") return res.status(503).json({ error: "El asistente no está disponible" });
  if (result.status === "error") return res.status(502).json({ error: "El asistente no pudo responder, intenta de nuevo" });

  res.json(result);
});

const aiSwapConfirmSchema = z.object({
  recipe: recipeDraftSchema,
});

// Create a Recipe from an AI-drafted option and attach it to the entry, consuming
// the same weekly action credit as the random shuffle-swap above.
router.post("/entries/:entryId/ai-swap/confirm", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = aiSwapConfirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: req.params.entryId },
    include: { mealPlan: true, recipe: true },
  });
  if (!entry || entry.mealPlan.userId !== req.userId) {
    return res.status(404).json({ error: "Comida no encontrada" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  // Structural fields (dietType, mealSlots) come from the entry being replaced, not
  // the model's output — the model is free to name/compose the recipe, but the diet
  // classification and slot must stay consistent with the app's own filtering (e.g.
  // the random shuffle-swap matches candidates by exact dietType string).
  const mealSlots = Array.from(new Set([entry.mealSlot, ...parsed.data.recipe.mealSlots]));
  const newRecipe = await prisma.recipe.create({
    data: { ...parsed.data.recipe, mealSlots, dietType: entry.recipe.dietType, source: "ai_generated" },
  });

  const updated = await prisma.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId: newRecipe.id },
    include: { recipe: true },
  });

  res.json({ ...updated, recipe: withSemaforo(updated.recipe) });
});

// Toggle a meal-plan entry between done/not-done; used to track adherence
// so we can later nudge users to complete their remaining meals.
router.post("/entries/:entryId/complete", authMiddleware, async (req: AuthRequest, res) => {
  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: req.params.entryId },
    include: { mealPlan: true },
  });
  if (!entry || entry.mealPlan.userId !== req.userId) {
    return res.status(404).json({ error: "Comida no encontrada" });
  }

  const updated = await prisma.mealPlanEntry.update({
    where: { id: entry.id },
    data: { completedAt: entry.completedAt ? null : new Date() },
    include: { recipe: true },
  });

  res.json({ ...updated, recipe: withSemaforo(updated.recipe) });
});

export default router;
