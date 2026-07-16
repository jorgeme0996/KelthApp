// Paleta de marca Kelth: verde salvia como color principal, sobre neutros
// grises claros. Los 4 colores funcionales (rojo/ámbar/lima/cian) son el
// semáforo del tratamiento — ver `semaforo` abajo y server/src/data/diets/*.json.
export const colors = {
  background: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceMuted: "#E5E7EB",

  text: "#1A1A1A",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",

  primary: "#A8AE8C", // verde salvia - acciones principales
  primaryDark: "#868A6F",
  primarySoft: "#EEF0E7",

  accent: "#FDCF4A", // ámbar - moderado / destacados
  accentSoft: "#FEF6DC",

  danger: "#FD0A3D", // rojo - prohibido / alertas
  dangerSoft: "#FFE1E6",

  border: "#E5E7EB",
  shadow: "#000000",
};

// Semáforo del tratamiento: clasifica cada categoría de alimento según
// server/src/data/diets/*.json (`semaforo`/`moderateEquivalents`). El nombre
// de la categoría ("naranja") no siempre coincide con el color mostrado —
// ver server/src/lib/semaforo.ts para el mapeo categoría→color.
export const semaforo = {
  rojo: "#FD0A3D", // prohibido
  naranja: "#FF8A3D", // moderado (cereales, leguminosas, tubérculos, frutas)
  amarillo: "#FFD23D", // moderado (oleaginosas, lácteos, quesos, aceites)
  azul: "#3B7DD8", // proteínas de alto valor biológico
  libre: "#7CC142", // sin restricción
};

export const slotColors: Record<string, string> = {
  desayuno: "#FDCF4A",
  colacion_am: "#C7CBB0",
  comida: "#A8AE8C",
  colacion_pm: "#C7CBB0",
  cena: "#01B9D5",
};

export const bodyPartColors: Record<string, string> = {
  chest: "#A8AE8C",
  back: "#868A6F",
  shoulders: "#01B9D5",
  biceps: "#C7CBB0",
  triceps: "#94997C",
  "upper arms": "#C7CBB0",
  "lower arms": "#C7CBB0",
  "upper legs": "#FDCF4A",
  "lower legs": "#FDCF4A",
  waist: "#FD0A3D",
  cardio: "#01B9D5",
  neck: "#9CA3AF",
};
