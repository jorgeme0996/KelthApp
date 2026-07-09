import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateAndSaveRoutine } from "../services/routineGenerator";
import { withExerciseMediaUrls } from "../lib/media";
import { startOfWeek } from "../lib/week";

const router = Router();

function serializeRoutine<T extends { entries: Array<{ exercise: any } & Record<string, unknown>> }>(routine: T) {
  return {
    ...routine,
    entries: routine.entries.map((entry) => ({
      ...entry,
      exercise: withExerciseMediaUrls(entry.exercise),
    })),
  };
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
    const routine = await generateAndSaveRoutine(
      user.id,
      user.exerciseDaysPerWeek ?? 3,
      weekStart,
      user.trainingDays,
      user.splitType,
      user.equipmentPreference,
    );
    res.status(201).json(serializeRoutine(routine));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/current", authMiddleware, async (req: AuthRequest, res) => {
  const routine = await prisma.routine.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { entries: { include: { exercise: true } } },
  });
  if (!routine) return res.status(404).json({ error: "Aún no tienes una rutina generada" });
  res.json(serializeRoutine(routine));
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const routine = await prisma.routine.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { entries: { include: { exercise: true } } },
  });
  if (!routine) return res.status(404).json({ error: "Rutina no encontrada" });
  res.json(serializeRoutine(routine));
});

const swapSchema = z.object({
  exerciseId: z.string().optional(),
});

// Swap a single routine entry for another exercise targeting the same body part
router.post("/entries/:entryId/swap", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = swapSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const entry = await prisma.routineEntry.findUnique({
    where: { id: req.params.entryId },
    include: { routine: true, exercise: true },
  });
  if (!entry || entry.routine.userId !== req.userId) {
    return res.status(404).json({ error: "Ejercicio no encontrado" });
  }

  let newExerciseId = parsed.data.exerciseId;
  if (!newExerciseId) {
    const candidates = await prisma.exercise.findMany({
      where: {
        bodyPart: entry.bodyPart,
        NOT: { id: entry.exerciseId },
      },
    });
    if (candidates.length === 0) return res.status(404).json({ error: "No hay alternativas disponibles" });
    newExerciseId = candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  const updated = await prisma.routineEntry.update({
    where: { id: entry.id },
    data: { exerciseId: newExerciseId },
    include: { exercise: true },
  });

  res.json({ ...updated, exercise: withExerciseMediaUrls(updated.exercise) });
});

export default router;
