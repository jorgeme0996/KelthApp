import { semaforo } from "@/theme";

// `color` viene del servidor (rojo/naranja/amarillo/azul/libre, ver
// server/src/lib/semaforo.ts) o null si la dieta de la receta todavía no
// tiene semáforo asignado — en ese caso no se pinta el chip.
export function semaforoColorHex(color: string | null): string | null {
  if (!color) return null;
  return (semaforo as Record<string, string>)[color] ?? null;
}
