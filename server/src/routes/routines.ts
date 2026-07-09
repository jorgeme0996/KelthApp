import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateAndSaveRoutine, regenerateRoutineDay } from "../services/routineGenerator";
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

const regenerateDaySchema = z.object({
  routineId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

// Regenerate a single day's exercises in-place, leaving the rest of the week untouched.
// Refuses to touch a day whose workout was already marked complete.
router.post("/regenerate-day", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = regenerateDaySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const routine = await prisma.routine.findFirst({
    where: { id: parsed.data.routineId, userId: req.userId },
  });
  if (!routine) return res.status(404).json({ error: "Rutina no encontrada" });

  const alreadyCompleted = await prisma.workoutCompletion.findFirst({
    where: { routineId: routine.id, dayIndex: parsed.data.dayIndex },
  });
  if (alreadyCompleted) {
    return res.status(400).json({ error: "Ya completaste el entrenamiento de este día, no se puede regenerar" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  try {
    const updated = await regenerateRoutineDay(routine.id, parsed.data.dayIndex, user.equipmentPreference);
    res.json(serializeRoutine(updated));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
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

// Recent completion history; used to detect "already completed today" and compute streaks
router.get("/completions", authMiddleware, async (req: AuthRequest, res) => {
  const completions = await prisma.workoutCompletion.findMany({
    where: { userId: req.userId },
    orderBy: { completedAt: "desc" },
    take: 60,
  });
  res.json(completions);
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

const completeDaySchema = z.object({
  routineId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

// Log a workout-day completion event; used later to power streaks/history features
router.post("/complete-day", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = completeDaySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const routine = await prisma.routine.findFirst({
    where: { id: parsed.data.routineId, userId: req.userId },
    include: { entries: { where: { dayIndex: parsed.data.dayIndex }, include: { exercise: true } } },
  });
  if (!routine) return res.status(404).json({ error: "Rutina no encontrada" });
  if (routine.entries.length === 0) return res.status(400).json({ error: "No hay ejercicios para ese día" });

  const bodyParts = [...new Set(routine.entries.map((entry) => entry.bodyPart))];
  const exerciseNames = routine.entries.map((entry) => entry.exercise.name);

  const completion = await prisma.workoutCompletion.create({
    data: {
      userId: req.userId!,
      routineId: routine.id,
      dayIndex: parsed.data.dayIndex,
      bodyParts,
      exerciseNames,
    },
  });

  res.status(201).json(completion);
});

const uncompleteDaySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
});

// Undo today's workout-day completion, e.g. if the user wants to redo it.
// Matched by calendar day (not routineId): a routine may have been regenerated
// since the completion was logged, which would leave it pointing at a stale routineId.
router.post("/uncomplete-day", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = uncompleteDaySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  await prisma.workoutCompletion.deleteMany({
    where: {
      userId: req.userId,
      dayIndex: parsed.data.dayIndex,
      completedAt: { gte: startOfDay, lt: endOfDay },
    },
  });

  res.status(204).send();
});

export default router;
