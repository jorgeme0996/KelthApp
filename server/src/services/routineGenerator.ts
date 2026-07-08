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
 * Generates a 7-day exercise routine: full-body sessions on the workout days
 * dictated by `daysPerWeek`, one exercise per targeted body part per session,
 * avoiding each body part's last 2 picks to keep the week varied.
 */
export function generateRoutineEntries(exercises: Exercise[], daysPerWeek: number): GeneratedEntry[] {
  const workoutDays = WORKOUT_DAY_PATTERNS[daysPerWeek] || WORKOUT_DAY_PATTERNS[3];

  const byBodyPart: Record<string, Exercise[]> = {};
  for (const bodyPart of ROUTINE_BODY_PARTS) {
    byBodyPart[bodyPart] = exercises.filter((e) => e.bodyPart === bodyPart);
  }

  const recentByBodyPart: Record<string, string[]> = {};
  const entries: GeneratedEntry[] = [];

  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    if (!workoutDays.includes(day)) continue;

    for (const bodyPart of ROUTINE_BODY_PARTS) {
      const all = byBodyPart[bodyPart] || [];
      if (all.length === 0) continue;

      const recent = recentByBodyPart[bodyPart] || [];
      let pool = all.filter((e) => !recent.includes(e.id));
      if (pool.length === 0) pool = all;

      const pick = pickRandom(pool);
      recentByBodyPart[bodyPart] = [...recent, pick.id].slice(-2);

      entries.push({ dayIndex: day, bodyPart, exerciseId: pick.id, ...defaultsFor(bodyPart) });
    }
  }

  return entries;
}

export async function generateAndSaveRoutine(userId: string, daysPerWeek: number, weekStart: Date) {
  const exercises = await prisma.exercise.findMany();
  if (exercises.length === 0) {
    throw new Error("No hay ejercicios disponibles. Ejecuta el seed de ejercicios primero.");
  }

  const entries = generateRoutineEntries(exercises, daysPerWeek);

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
