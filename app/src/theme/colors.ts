// Paleta inspirada en el semáforo nutricional: verde (libre), ámbar (moderado),
// coral (informativo/prohibido) sobre un fondo cálido y neutro tipo "papel".
export const colors = {
  background: "#FBF7F1",
  surface: "#FFFFFF",
  surfaceMuted: "#F3EEE6",

  text: "#33312E",
  textMuted: "#857F77",
  textOnPrimary: "#FFFFFF",

  primary: "#5FA777", // verde salvia - permitido / acciones principales
  primaryDark: "#447A57",
  primarySoft: "#E3F1E8",

  accent: "#F2A341", // ámbar - moderado / destacados
  accentSoft: "#FBEAD2",

  danger: "#E76F51", // coral - prohibido / alertas (uso informativo, no punitivo)
  dangerSoft: "#FBE6E0",

  border: "#E8E1D6",
  shadow: "#000000",
};

export const slotColors: Record<string, string> = {
  desayuno: "#F2A341",
  colacion_am: "#8FBF9F",
  comida: "#5FA777",
  colacion_pm: "#8FBF9F",
  cena: "#7A93C9",
};

export const bodyPartColors: Record<string, string> = {
  chest: "#5FA777",
  back: "#447A57",
  shoulders: "#7A93C9",
  "upper arms": "#8FBF9F",
  "lower arms": "#8FBF9F",
  "upper legs": "#F2A341",
  "lower legs": "#F2A341",
  waist: "#E76F51",
  cardio: "#7A93C9",
  neck: "#857F77",
};
