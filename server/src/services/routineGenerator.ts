import { Exercise } from "@prisma/client";
import { prisma } from "../prisma";

const DAYS_PER_WEEK = 7;

const WORKOUT_DAY_PATTERNS: Record<number, number[]> = {
  3: [0, 2, 4], // Lunes, Miércoles, Viernes
  4: [0, 1, 3, 4], // Lunes, Martes, Jueves, Viernes
  5: [0, 1, 2, 3, 4], // Lunes a Viernes
};

const ROUTINE_BODY_PARTS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "lower arms",
  "upper legs",
  "lower legs",
  "waist",
  "cardio",
];

// "biceps"/"triceps" aren't real Exercise.bodyPart values - they're sub-targets
// of the "upper arms" bucket, filtered via Exercise.target instead (see byBodyPart below).
const TARGET_FILTERED_BODY_PARTS: Record<string, string> = {
  biceps: "upper arms",
  triceps: "upper arms",
};

const HOME_EQUIPMENT = ["body weight", "dumbbell", "band", "resistance band", "kettlebell"];

// Each template's day count matches the key exactly, so indexing by dayPosition
// never wraps around - every group appears once per week, nothing repeats.
const SPLIT_TEMPLATES: Record<number, string[][]> = {
  3: [
    ["chest", "shoulders", "triceps"],
    ["back", "biceps", "lower arms"],
    ["upper legs", "lower legs", "waist", "cardio"],
  ],
  4: [
    ["chest", "shoulders", "triceps"],
    ["back", "biceps"],
    ["upper legs", "lower legs", "cardio"],
    ["lower arms", "waist"],
  ],
  5: [
    ["chest", "triceps"],
    ["back", "biceps"],
    ["upper legs", "lower legs"],
    ["shoulders", "waist"],
    ["lower arms", "cardio"],
  ],
};

const EXERCISES_PER_BODY_PART = { fullbody: 1, split: 2 } as const;

interface GeneratedEntry {
  dayIndex: number;
  bodyPart: string;
  exerciseId: string;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function defaultsFor(bodyPart: string): { sets: number; reps: number | null; durationSeconds: number | null } {
  if (bodyPart === "cardio") return { sets: 1, reps: null, durationSeconds: 600 };
  return { sets: 3, reps: 12, durationSeconds: null };
}

/**
 * Generates a 7-day exercise routine. On "fullbody" every workout day hits
 * all body parts once; on "split" workout days follow a template (picked by
 * number of training days) that covers every body part exactly once across
 * the week with no repeats. `trainingDays`, when non-empty, pins the exact
 * weekday indices to use instead of the legacy `daysPerWeek` pattern.
 */
export function generateRoutineEntries(
  exercises: Exercise[],
  daysPerWeek: number,
  trainingDays: number[] = [],
  splitType: "fullbody" | "split" = "fullbody",
  equipmentPreference: "gym" | "home" = "gym",
): GeneratedEntry[] {
  const workoutDays =
    trainingDays.length > 0
      ? [...trainingDays].sort((a, b) => a - b)
      : WORKOUT_DAY_PATTERNS[daysPerWeek] || WORKOUT_DAY_PATTERNS[3];

  const availableExercises =
    equipmentPreference === "home" ? exercises.filter((e) => HOME_EQUIPMENT.includes(e.equipment)) : exercises;

  const byBodyPart: Record<string, Exercise[]> = {};
  for (const bodyPart of ROUTINE_BODY_PARTS) {
    const sourceBodyPart = TARGET_FILTERED_BODY_PARTS[bodyPart];
    byBodyPart[bodyPart] = sourceBodyPart
      ? availableExercises.filter((e) => e.bodyPart === sourceBodyPart && e.target === bodyPart)
      : availableExercises.filter((e) => e.bodyPart === bodyPart);
  }

  const recentByBodyPart: Record<string, string[]> = {};
  const entries: GeneratedEntry[] = [];
  const exercisesPerBodyPart = EXERCISES_PER_BODY_PART[splitType];

  const splitTemplate = SPLIT_TEMPLATES[workoutDays.length] || SPLIT_TEMPLATES[3];

  workoutDays.forEach((day, dayPosition) => {
    const bodyPartsForDay = splitType === "split" ? splitTemplate[dayPosition] || [] : ROUTINE_BODY_PARTS;

    for (const bodyPart of bodyPartsForDay) {
      const all = byBodyPart[bodyPart] || [];
      if (all.length === 0) continue;

      for (let i = 0; i < exercisesPerBodyPart; i++) {
        const recent = recentByBodyPart[bodyPart] || [];
        let pool = all.filter((e) => !recent.includes(e.id));
        if (pool.length === 0) pool = all;

        const pick = pickRandom(pool);
        recentByBodyPart[bodyPart] = [...recent, pick.id].slice(-2);

        entries.push({ dayIndex: day, bodyPart, exerciseId: pick.id, ...defaultsFor(bodyPart) });
      }
    }
  });

  return entries;
}

export async function generateAndSaveRoutine(
  userId: string,
  daysPerWeek: number,
  weekStart: Date,
  trainingDays: number[] = [],
  splitType: string = "fullbody",
  equipmentPreference: string = "gym",
) {
  const exercises = await prisma.exercise.findMany();
  if (exercises.length === 0) {
    throw new Error("No hay ejercicios disponibles. Ejecuta el seed de ejercicios primero.");
  }

  const entries = generateRoutineEntries(
    exercises,
    daysPerWeek,
    trainingDays,
    splitType === "split" ? "split" : "fullbody",
    equipmentPreference === "home" ? "home" : "gym",
  );

  const routine = await prisma.routine.create({
    data: {
      userId,
      daysPerWeek,
      weekStart,
      entries: {
        create: entries.map((e) => ({
          dayIndex: e.dayIndex,
          bodyPart: e.bodyPart,
          exerciseId: e.exerciseId,
          sets: e.sets,
          reps: e.reps,
          durationSeconds: e.durationSeconds,
        })),
      },
    },
    include: {
      entries: { include: { exercise: true } },
    },
  });

  return routine;
}

/**
 * Regenerates the exercises for a single day of an existing routine, keeping
 * the same body parts (and sets/reps/duration) already assigned to that day
 * and just picking new exercises for them. Rest days (no entries) have
 * nothing to regenerate.
 */
export async function regenerateRoutineDay(
  routineId: string,
  dayIndex: number,
  equipmentPreference: string = "gym",
) {
  const existingEntries = await prisma.routineEntry.findMany({ where: { routineId, dayIndex } });
  if (existingEntries.length === 0) {
    throw new Error("Día de descanso, no hay nada que regenerar");
  }

  const exercises = await prisma.exercise.findMany();
  const availableExercises =
    equipmentPreference === "home" ? exercises.filter((e) => HOME_EQUIPMENT.includes(e.equipment)) : exercises;

  const byBodyPart: Record<string, Exercise[]> = {};
  for (const bodyPart of new Set(existingEntries.map((e) => e.bodyPart))) {
    const sourceBodyPart = TARGET_FILTERED_BODY_PARTS[bodyPart];
    byBodyPart[bodyPart] = sourceBodyPart
      ? availableExercises.filter((e) => e.bodyPart === sourceBodyPart && e.target === bodyPart)
      : availableExercises.filter((e) => e.bodyPart === bodyPart);
  }

  const usedIds = new Set<string>();
  const updates: { id: string; exerciseId: string }[] = [];

  for (const entry of existingEntries) {
    const candidates = byBodyPart[entry.bodyPart] || [];
    let pool = candidates.filter((e) => e.id !== entry.exerciseId && !usedIds.has(e.id));
    if (pool.length === 0) pool = candidates.filter((e) => !usedIds.has(e.id));
    if (pool.length === 0) pool = candidates;
    if (pool.length === 0) continue;

    const pick = pickRandom(pool);
    usedIds.add(pick.id);
    updates.push({ id: entry.id, exerciseId: pick.id });
  }

  await prisma.$transaction(
    updates.map((u) => prisma.routineEntry.update({ where: { id: u.id }, data: { exerciseId: u.exerciseId } })),
  );

  return prisma.routine.findUniqueOrThrow({
    where: { id: routineId },
    include: { entries: { include: { exercise: true } } },
  });
}
