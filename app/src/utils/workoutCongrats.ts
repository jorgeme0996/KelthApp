const CONGRATS_TEMPLATES: ((name: string, day: string, parts: string) => string)[] = [
  (name, day, parts) =>
    `¡Excelente trabajo, ${name}! Terminaste tu entrenamiento de ${day} (${parts}). Sigue así, cada sesión te acerca a tu objetivo. 💪`,
  (name, day, parts) => `¡Lo lograste, ${name}! Completaste ${day} trabajando ${parts}. Tu constancia está dando frutos.`,
  (name, day, parts) =>
    `${name}, gran sesión de ${day}. Trabajaste ${parts} y eso es justo lo que te acerca a tu meta. ¡Sigue así!`,
];

export function getWorkoutCongratsMessage(name: string, day: string, parts: string) {
  const template = CONGRATS_TEMPLATES[Math.floor(Math.random() * CONGRATS_TEMPLATES.length)];
  return template(name, day, parts);
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function computeWorkoutStreak(completedDateKeys: Set<string>, referenceDate: Date): number {
  let streak = 0;
  const cursor = new Date(referenceDate);
  while (completedDateKeys.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatExerciseList(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length === 0) return "tu entrenamiento";
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(", ")} y ${unique[unique.length - 1]}`;
}

const STREAK_TEMPLATES: ((name: string, exercises: string, streak: number) => string)[] = [
  (name, exercises, streak) =>
    `¡${streak} días seguidos, ${name}! Hoy le sumaste ${exercises} a tu racha. No la rompas mañana. 🔥`,
  (name, exercises, streak) =>
    `Racha de ${streak} días y contando, ${name}. Completaste ${exercises} hoy. ¡Esa constancia es oro! 🔥`,
  (name, exercises, streak) =>
    `Vas en racha, ${name}: ${streak} días entrenando sin fallar, hoy con ${exercises}. ¡Sigue así! 🔥`,
];

const FIRST_DAY_TEMPLATES: ((name: string, exercises: string) => string)[] = [
  (name, exercises) => `¡Completaste ${exercises}, ${name}! Ese es el primer paso de tu racha, mañana toca seguirla. 💪`,
  (name, exercises) => `¡Buen trabajo con ${exercises}, ${name}! Arrancaste tu racha de entrenamientos, no la dejes ir. 💪`,
];

export function getWorkoutDoneTodayMessage(name: string, exerciseNames: string[], streak: number): string {
  const exercises = formatExerciseList(exerciseNames);
  if (streak > 1) {
    const template = STREAK_TEMPLATES[Math.floor(Math.random() * STREAK_TEMPLATES.length)];
    return template(name, exercises, streak);
  }
  const template = FIRST_DAY_TEMPLATES[Math.floor(Math.random() * FIRST_DAY_TEMPLATES.length)];
  return template(name, exercises);
}
