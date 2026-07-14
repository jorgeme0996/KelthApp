export interface User {
  id: string;
  email: string;
  name: string;
  mealsPerDay: number;
  exerciseDaysPerWeek: number | null;
  dietType: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: string | null;
  gender: string | null;
  splitType: string;
  equipmentPreference: string;
  dietaryRestrictions: string[];
  trainingDays: number[];
  phone: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: string | null;
}

// Mirrors the backend's isPremium() in server/src/services/billing.ts — keep in lockstep.
export function isPremiumUser(user: User | null | undefined): boolean {
  if (!user?.subscriptionStatus || !["active", "trialing"].includes(user.subscriptionStatus)) return false;
  if (user.currentPeriodEnd && new Date(user.currentPeriodEnd) < new Date()) return false;
  return true;
}

export type Gender = "hombre" | "mujer" | "prefiero_no_decir";
export type Goal = "bajar_peso" | "mantener_peso" | "subir_masa";
export type DietId = "lowcarb" | "maintenance" | "muscle-gain";
export type SplitType = "fullbody" | "split";
export type EquipmentPreference = "gym" | "home";
export type DietaryRestriction =
  | "vegetariano"
  | "vegano"
  | "sin_lacteos"
  | "sin_nueces"
  | "sin_mariscos"
  | "sin_gluten";

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
  { value: "prefiero_no_decir", label: "Prefiero no decir" },
];

export const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: "bajar_peso", label: "Bajar de peso", description: "Quiero reducir mi peso con un plan controlado." },
  { value: "mantener_peso", label: "Mantenerme. Comer mejor.", description: "Quiero mantener mi peso y mejorar mis hábitos." },
  { value: "subir_masa", label: "Subir masa muscular", description: "Quiero ganar músculo con una alimentación adecuada." },
];

const DIET_ID_BY_GOAL: Record<Goal, DietId> = {
  bajar_peso: "lowcarb",
  mantener_peso: "maintenance",
  subir_masa: "muscle-gain",
};

// El objetivo del usuario determina el "base" del menú (presupuestos de
// porciones); debe reflejar el mapeo de server/src/lib/dietGoal.ts.
export function dietIdForGoal(goal: string | null | undefined): DietId {
  if (goal && goal in DIET_ID_BY_GOAL) return DIET_ID_BY_GOAL[goal as Goal];
  return DIET_ID_BY_GOAL.bajar_peso;
}

export const SPLIT_TYPE_OPTIONS: { value: SplitType; label: string; helper: string }[] = [
  { value: "fullbody", label: "Fullbody", helper: "Todo el cuerpo cada sesión" },
  { value: "split", label: "Split", helper: "Una parte del cuerpo cada día" },
];

export const EQUIPMENT_PREFERENCE_OPTIONS: { value: EquipmentPreference; label: string; helper: string }[] = [
  { value: "gym", label: "Gimnasio", helper: "Acceso a máquinas y pesas" },
  { value: "home", label: "Casa", helper: "Peso corporal, mancuernas o bandas" },
];

export const DIETARY_RESTRICTION_OPTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "sin_lacteos", label: "Sin lácteos" },
  { value: "sin_nueces", label: "Sin nueces" },
  { value: "sin_mariscos", label: "Sin mariscos" },
  { value: "sin_gluten", label: "Sin gluten" },
];

export const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  category: string;
}

export interface SemaforoEntry {
  category: string;
  color: string | null;
  label: string;
}

export interface Recipe {
  id: string;
  name: string;
  mealSlots: string[];
  cuisineTags: string[];
  ingredients: Ingredient[];
  steps: string[];
  prepTimeMinutes: number | null;
  equivalents: Record<string, number>;
  weeklyLimited: boolean;
  dietType: string;
  source: string;
  semaforo: SemaforoEntry[];
}

export interface MealPlanEntry {
  id: string;
  mealPlanId: string;
  dayIndex: number;
  mealSlot: string;
  recipeId: string;
  completedAt: string | null;
  recipe: Recipe;
}

export interface MealPlan {
  id: string;
  userId: string;
  weekStart: string;
  mealsPerDay: number;
  createdAt: string;
  entries: MealPlanEntry[];
}

export interface ShoppingListItem {
  name: string;
  unit: string;
  qty: number;
  category: string;
}

export interface ShoppingListResponse {
  mealPlanId: string;
  sections: Record<string, ShoppingListItem[]>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Nutriologo {
  name: string;
  phone: string;
}

export interface PremiumRequiredError {
  error: string;
  code: "PREMIUM_REQUIRED";
}

export interface ChatPremiumRequiredError extends PremiumRequiredError {
  nutriologos: Nutriologo[];
}

export type MealSwapMode = "fridge" | "restaurant_options" | "menu_photo";

export interface MealSwapChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface MealSwapImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

export interface RecipeDraft {
  name: string;
  mealSlots: string[];
  cuisineTags: string[];
  ingredients: Ingredient[];
  steps: string[];
  equivalents: Record<string, number>;
  weeklyLimited: boolean;
  prepTimeMinutes: number | null;
  dietType: string;
}

export type MealSwapChatResponse =
  | { status: "message"; reply: string }
  | { status: "options"; options: RecipeDraft[] };

export const MEAL_SLOT_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  colacion_am: "Colación matutina",
  comida: "Comida",
  colacion_pm: "Colación vespertina",
  cena: "Cena",
};

export const MEAL_SLOT_ORDER = ["desayuno", "colacion_am", "comida", "colacion_pm", "cena"];

export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  instructions: string;
  instructionSteps: string[];
  muscleGroup: string;
  secondaryMuscles: string[];
  target: string;
  imageUrl: string | null;
  gifUrl: string | null;
  attribution: string;
  source: string;
}

export interface RoutineEntry {
  id: string;
  routineId: string;
  dayIndex: number;
  bodyPart: string;
  exerciseId: string;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  exercise: Exercise;
}

export interface Routine {
  id: string;
  userId: string;
  weekStart: string;
  daysPerWeek: number;
  createdAt: string;
  entries: RoutineEntry[];
}

export interface WorkoutCompletion {
  id: string;
  userId: string;
  routineId: string;
  dayIndex: number;
  bodyParts: string[];
  exerciseNames: string[];
  completedAt: string;
}

export const BODY_PART_ORDER = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "upper arms",
  "lower arms",
  "upper legs",
  "lower legs",
  "waist",
  "cardio",
  "neck",
];

export type ExerciseSwapMode = "equipment_unavailable" | "technique_help";

export interface ExerciseSwapChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ExerciseDraft {
  name: string;
  equipment: string;
  instructions: string;
  instructionSteps: string[];
  muscleGroup: string;
  secondaryMuscles: string[];
  target: string;
}

export type ExerciseOption =
  | { kind: "catalog"; exerciseId: string; exercise: Exercise }
  | { kind: "ai_generated"; draft: ExerciseDraft };

export type ExerciseSwapChatResponse =
  | { status: "message"; reply: string }
  | { status: "options"; options: ExerciseOption[] };

export interface RoutineAdaptChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface RoutineDayChangeEntry {
  entryId: string;
  option: ExerciseOption;
  sets?: number;
  reps?: number | null;
  durationSeconds?: number | null;
}

export interface RoutineDayChange {
  dayIndex: number;
  reason: string;
  entries: RoutineDayChangeEntry[];
  removeEntryIds: string[];
}

export type RoutineAdaptChatResponse =
  | { status: "message"; reply: string }
  | { status: "adaptation"; summary: string; dayChanges: RoutineDayChange[] };

export interface RoutineAdaptConfirmResponse extends Routine {
  skippedDays: number[];
}

export const BODY_PART_LABELS: Record<string, string> = {
  back: "Espalda",
  biceps: "Bíceps",
  cardio: "Cardio",
  chest: "Pecho",
  "lower arms": "Antebrazos",
  "lower legs": "Piernas (pantorrilla)",
  neck: "Cuello",
  shoulders: "Hombros",
  triceps: "Tríceps",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist: "Abdomen",
};
