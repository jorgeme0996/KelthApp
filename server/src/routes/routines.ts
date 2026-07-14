import { Router } from "express";
import { z } from "zod";
import { Exercise, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateAndSaveRoutine, regenerateRoutineDay, TARGET_FILTERED_BODY_PARTS } from "../services/routineGenerator";
import { withExerciseMediaUrls } from "../lib/media";
import { startOfWeek } from "../lib/week";
import { isPremium } from "../services/billing";
import { ExerciseDraft, ExerciseOption, exerciseOptionSchema, runExerciseSwapChatTurn } from "../services/exerciseSwapAssistant";
import { runRoutineAdaptChatTurn, proposeRoutineAdaptationInputSchema } from "../services/routineAdaptAssistant";

const PREMIUM_REQUIRED_ERROR = {
  error: "Esta función requiere Premium.",
  code: "PREMIUM_REQUIRED",
};

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

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

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

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

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

// Creates a new Exercise row for an AI-drafted option that had no catalog match.
// bodyPart is always derived server-side from the real RoutineEntry.bodyPart being
// replaced (never trusted from the model/client) so future pooling (regenerate-day,
// random swap) can find it via the same TARGET_FILTERED_BODY_PARTS mapping the
// generator uses — e.g. a "biceps" entry must become an Exercise with
// bodyPart: "upper arms", target: "biceps", not bodyPart: "biceps".
async function createAiGeneratedExercise(
  db: Prisma.TransactionClient | PrismaClient,
  entryBodyPart: string,
  draft: ExerciseDraft,
): Promise<Exercise> {
  const mappedBodyPart = TARGET_FILTERED_BODY_PARTS[entryBodyPart];
  return db.exercise.create({
    data: {
      id: crypto.randomUUID(),
      name: draft.name,
      bodyPart: mappedBodyPart ?? entryBodyPart,
      equipment: draft.equipment,
      instructions: draft.instructions,
      instructionSteps: draft.instructionSteps,
      muscleGroup: draft.muscleGroup,
      secondaryMuscles: draft.secondaryMuscles,
      target: mappedBodyPart ?? draft.target,
      image: null,
      gifUrl: null,
      attribution: "",
      source: "ai_generated",
    },
  });
}

// Resolves each "catalog" option's exerciseId into a full Exercise row (with media
// URLs) so the client never needs a second round trip to render option cards.
// "ai_generated" options pass through untouched. Options whose catalog id can't be
// found (shouldn't happen — the model only ever sees ids from its own searches) are
// dropped rather than surfaced as a broken card.
async function hydrateCatalogExercises(options: ExerciseOption[]): Promise<Map<string, ReturnType<typeof withExerciseMediaUrls>>> {
  const ids = options.filter((o) => o.kind === "catalog").map((o) => o.exerciseId);
  if (ids.length === 0) return new Map();
  const rows = await prisma.exercise.findMany({ where: { id: { in: ids } } });
  return new Map(rows.map((row) => [row.id, withExerciseMediaUrls(row)]));
}

function hydrateOption(option: ExerciseOption, byId: Map<string, ReturnType<typeof withExerciseMediaUrls>>) {
  if (option.kind === "ai_generated") return { kind: "ai_generated" as const, draft: option.draft };
  const exercise = byId.get(option.exerciseId);
  if (!exercise) return null;
  return { kind: "catalog" as const, exerciseId: option.exerciseId, exercise };
}

const exerciseSwapChatSchema = z.object({
  mode: z.enum(["equipment_unavailable", "technique_help"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(12),
});

// Conversational turn of the AI exercise-swap flow (equipment unavailable / technique
// help). Stateless: the client resends the running message array each turn.
router.post("/entries/:entryId/ai-swap/chat", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = exerciseSwapChatSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const entry = await prisma.routineEntry.findUnique({
    where: { id: req.params.entryId },
    include: { routine: true, exercise: true },
  });
  if (!entry || entry.routine.userId !== req.userId) {
    return res.status(404).json({ error: "Ejercicio no encontrado" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  const result = await runExerciseSwapChatTurn(parsed.data.mode, entry.bodyPart, entry.exercise.name, parsed.data.messages);

  if (result.status === "unavailable") return res.status(503).json({ error: "El asistente no está disponible" });
  if (result.status === "error") return res.status(502).json({ error: "El asistente no pudo responder, intenta de nuevo" });

  if (result.status === "options") {
    const byId = await hydrateCatalogExercises(result.options);
    const options = result.options.map((o) => hydrateOption(o, byId)).filter((o): o is NonNullable<typeof o> => o !== null);
    return res.json({ status: "options", options });
  }

  res.json(result);
});

const exerciseSwapConfirmSchema = z.object({ option: exerciseOptionSchema });

// Applies a chosen exercise-swap option to a routine entry, consuming the same
// weekly action credit as the random shuffle-swap.
router.post("/entries/:entryId/ai-swap/confirm", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = exerciseSwapConfirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const entry = await prisma.routineEntry.findUnique({
    where: { id: req.params.entryId },
    include: { routine: true },
  });
  if (!entry || entry.routine.userId !== req.userId) {
    return res.status(404).json({ error: "Ejercicio no encontrado" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  let exerciseId: string;
  if (parsed.data.option.kind === "catalog") {
    const exists = await prisma.exercise.findUnique({ where: { id: parsed.data.option.exerciseId } });
    if (!exists) return res.status(400).json({ error: "Ejercicio no encontrado en el catálogo" });
    exerciseId = exists.id;
  } else {
    const created = await createAiGeneratedExercise(prisma, entry.bodyPart, parsed.data.option.draft);
    exerciseId = created.id;
  }

  const updated = await prisma.routineEntry.update({ where: { id: entry.id }, data: { exerciseId }, include: { exercise: true } });
  res.json({ ...updated, exercise: withExerciseMediaUrls(updated.exercise) });
});

const routineAdaptChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(12),
});

// Conversational turn of the AI whole-routine adaptation flow.
router.post("/:id/ai-adapt/chat", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = routineAdaptChatSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const routine = await prisma.routine.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { entries: { include: { exercise: true } } },
  });
  if (!routine) return res.status(404).json({ error: "Rutina no encontrada" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  const result = await runRoutineAdaptChatTurn(routine, parsed.data.messages);

  if (result.status === "unavailable") return res.status(503).json({ error: "El asistente no está disponible" });
  if (result.status === "error") return res.status(502).json({ error: "El asistente no pudo responder, intenta de nuevo" });

  if (result.status === "adaptation") {
    const allOptions = result.adaptation.dayChanges.flatMap((d) => d.entries.map((e) => e.option));
    const byId = await hydrateCatalogExercises(allOptions);
    const dayChanges = result.adaptation.dayChanges
      .map((day) => ({
        dayIndex: day.dayIndex,
        reason: day.reason,
        entries: day.entries
          .map((e) => {
            const option = hydrateOption(e.option, byId);
            if (!option) return null;
            return { entryId: e.entryId, option, sets: e.sets, reps: e.reps, durationSeconds: e.durationSeconds };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null),
        removeEntryIds: day.removeEntryIds,
      }))
      .filter((day) => day.entries.length > 0 || day.removeEntryIds.length > 0);
    return res.json({ status: "adaptation", summary: result.adaptation.summary, dayChanges });
  }

  res.json(result);
});

const routineAdaptDayChangeSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  reason: z.string().min(1),
  entries: z
    .array(
      z.object({
        entryId: z.string().min(1),
        option: exerciseOptionSchema,
        sets: z.number().int().positive().optional(),
        reps: z.number().int().positive().nullable().optional(),
        durationSeconds: z.number().int().positive().nullable().optional(),
      }),
    )
    .default([]),
  removeEntryIds: z.array(z.string().min(1)).default([]),
});

const routineAdaptConfirmSchema = z.object({
  adaptation: z.object({
    summary: z.string().min(1),
    dayChanges: z.array(routineAdaptDayChangeSchema).min(1),
  }),
});

// Applies the confirmed whole-routine adaptation. Days already marked complete are
// skipped rather than overwritten (same rule as /regenerate-day), and the whole
// confirm consumes a single weekly action credit regardless of how many days change.
router.post("/:id/ai-adapt/confirm", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = routineAdaptConfirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const routine = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!routine) return res.status(404).json({ error: "Rutina no encontrada" });

  const touchedDays = parsed.data.adaptation.dayChanges.map((d) => d.dayIndex);
  const completed = await prisma.workoutCompletion.findMany({ where: { routineId: routine.id, dayIndex: { in: touchedDays } } });
  const completedSet = new Set(completed.map((c) => c.dayIndex));
  const applicableChanges = parsed.data.adaptation.dayChanges.filter((d) => !completedSet.has(d.dayIndex));
  if (applicableChanges.length === 0) {
    return res.status(400).json({ error: "Todos los días propuestos ya están marcados como completados" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!isPremium(user)) return res.status(403).json(PREMIUM_REQUIRED_ERROR);

  // Only ever touch entries that actually belong to this routine — never trust
  // client-sent entryIds blindly.
  const entryIds = applicableChanges.flatMap((d) => [...d.entries.map((e) => e.entryId), ...d.removeEntryIds]);
  const existingEntries = await prisma.routineEntry.findMany({ where: { id: { in: entryIds }, routineId: routine.id } });
  const entryById = new Map(existingEntries.map((e) => [e.id, e]));

  await prisma.$transaction(async (tx) => {
    for (const day of applicableChanges) {
      for (const change of day.entries) {
        const existingEntry = entryById.get(change.entryId);
        if (!existingEntry) continue;

        let exerciseId: string;
        if (change.option.kind === "catalog") {
          const exists = await tx.exercise.findUnique({ where: { id: change.option.exerciseId } });
          if (!exists) continue;
          exerciseId = exists.id;
        } else {
          const created = await createAiGeneratedExercise(tx, existingEntry.bodyPart, change.option.draft);
          exerciseId = created.id;
        }

        await tx.routineEntry.update({
          where: { id: change.entryId },
          data: {
            exerciseId,
            ...(change.sets !== undefined && { sets: change.sets }),
            ...(change.reps !== undefined && { reps: change.reps }),
            ...(change.durationSeconds !== undefined && { durationSeconds: change.durationSeconds }),
          },
        });
      }

      const removableIds = day.removeEntryIds.filter((id) => entryById.has(id));
      if (removableIds.length > 0) {
        await tx.routineEntry.deleteMany({ where: { id: { in: removableIds } } });
      }
    }
  });

  const updated = await prisma.routine.findUniqueOrThrow({
    where: { id: routine.id },
    include: { entries: { include: { exercise: true } } },
  });
  res.json({ ...serializeRoutine(updated), skippedDays: touchedDays.filter((d) => completedSet.has(d)) });
});

export default router;
