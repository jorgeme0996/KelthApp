import { semaforo } from "@/theme";
import { DietId } from "@/types";

// `color` viene del servidor (rojo/naranja/amarillo/azul/libre, ver
// server/src/lib/semaforo.ts) o null si la dieta de la receta todavía no
// tiene semáforo asignado — en ese caso no se pinta el chip.
export function semaforoColorHex(color: string | null): string | null {
  if (!color) return null;
  return (semaforo as Record<string, string>)[color] ?? null;
}

export interface SemaforoCard {
  color: string;
  hex: string;
  title: string;
  description: string;
}

// Colores que cada dieta realmente usa hoy (ver server/src/data/diets/*.json
// `semaforo`). lowcarb y maintenance tienen naranja/amarillo (sin azul, ya
// que ahí las proteínas son libres) — maintenance es el mismo plan que
// lowcarb, solo menos restrictivo; muscle-gain tiene naranja/amarillo/azul.
export const DIET_COLORS: Record<DietId, string[]> = {
  lowcarb: ["rojo", "naranja", "amarillo", "libre"],
  maintenance: ["rojo", "naranja", "amarillo", "libre"],
  "muscle-gain": ["rojo", "naranja", "amarillo", "azul", "libre"],
};

export const SEMAFORO_CARDS: SemaforoCard[] = [
  {
    color: "rojo",
    hex: semaforo.rojo,
    title: "Rojo — evita",
    description: "Alimentos que van claramente en contra de tu tratamiento (azúcar añadida, frituras, ultraprocesados). No forman parte de tu menú.",
  },
  {
    color: "naranja",
    hex: semaforo.naranja,
    title: "Naranja — moderado",
    description: "Cereales, leguminosas, tubérculos y frutas: aportan energía pero se controlan por porción ('equivalente') para no pasarte de tu presupuesto diario.",
  },
  {
    color: "amarillo",
    hex: semaforo.amarillo,
    title: "Amarillo — moderado",
    description: "Oleaginosas, lácteos, quesos, aceites y grasas: también se cuentan por equivalente, igual que el naranja, pero son un grupo distinto.",
  },
  {
    color: "azul",
    hex: semaforo.azul,
    title: "Azul — proteína de alto valor",
    description: "Tus fuentes de proteína prioritarias. Se permiten con más libertad porque son la base de tu tratamiento.",
  },
  {
    color: "libre",
    hex: semaforo.libre,
    title: "Verde — libre",
    description: "Verduras y otros alimentos sin restricción de porción: puedes comerlos con la frecuencia que quieras.",
  },
];
