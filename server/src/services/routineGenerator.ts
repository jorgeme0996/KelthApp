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
  "upper arms",
  "lower arms",
  "upper legs",
  "lower legs",
  "waist",
  "cardio",
];

const HOME_EQUIPMENT = ["body weight", "dumbbell", "band", "resistance band", "kettlebell"];

const SPLIT_PUSH = ["chest", "shoulders", "upper arms"];
const SPLIT_PULL = ["back", "lower arms", "waist"];
const SPLIT_LEGS = ["upper legs", "lower legs", "cardio"];
const SPLIT_GROUPS = [SPLIT_PUSH, SPLIT_PULL, SPLIT_LEGS];

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
 * all body parts once; on "split" workout days cycle through Push/Pull/Legs
 * groups, doing more exercises per body part to keep session volume similar.
 * `trainingDays`, when non-empty, pins the exact weekday indices to use
 * instead of the legacy `daysPerWeek` pattern.
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
    byBodyPart[bodyPart] = availableExercises.filter((e) => e.bodyPart === bodyPart);
  }

  const recentByBodyPart: Record<string, string[]> = {};
  const entries: GeneratedEntry[] = [];
  const exercisesPerBodyPart = EXERCISES_PER_BODY_PART[splitType];

  workoutDays.forEach((day, dayPosition) => {
    const bodyPartsForDay = splitType === "split" ? SPLIT_GROUPS[dayPosition % SPLIT_GROUPS.length] : ROUTINE_BODY_PARTS;

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
