export interface User {
  id: string;
  email: string;
  name: string;
  mealsPerDay: number;
  exerciseDaysPerWeek: number | null;
  dietType: string;
  dailyChatLimit: number | null;
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
}

export type Gender = "hombre" | "mujer" | "prefiero_no_decir";
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

export interface ChatLimitError {
  error: string;
  code: "DAILY_LIMIT_REACHED";
  nutriologos: Nutriologo[];
}

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
  imageUrl: string;
  gifUrl: string;
  attribution: string;
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

export const BODY_PART_ORDER = [
  "chest",
  "back",
  "shoulders",
  "upper arms",
  "lower arms",
  "upper legs",
  "lower legs",
  "waist",
  "cardio",
  "neck",
];

export const BODY_PART_LABELS: Record<string, string> = {
  back: "Espalda",
  cardio: "Cardio",
  chest: "Pecho",
  "lower arms": "Antebrazos",
  "lower legs": "Piernas (pantorrilla)",
  neck: "Cuello",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist: "Abdomen",
};
