// Nivel de comodines para la dieta de ganancia de masa muscular, derivado del
// IMC: qué tan por debajo del piso de peso saludable (IMC 18.5) está el
// paciente determina cuántas concesiones semanales por color se le otorgan
// (ver `comodines` en server/src/data/diets/muscle-gain.json).
export type MuscleGainComodinTier = "desnutricion_15kg" | "bajo_peso_10kg" | "aumento_masa_5kg";

// Nivel de comodines para low-carb, derivado del IMC: qué tantos kg de más
// tiene el paciente sobre el techo de peso saludable (IMC 25) determina
// cuántas concesiones semanales por color se le otorgan (ver `comodines` en
// server/src/data/diets/lowcarb.json).
export type LowCarbComodinTier = "sobrepeso_1kg" | "sobrepeso_10kg" | "obesidad_20kg";

// Mantenimiento usa un único cupo semanal fijo (no depende del peso del
// paciente, a diferencia de low-carb/muscle-gain) — mismo nivel que la
// franja menos restrictiva de low-carb (ver `comodines` en
// server/src/data/diets/maintenance.json).
export type MaintenanceComodinTier = "estandar";

export type ComodinTier = MuscleGainComodinTier | LowCarbComodinTier | MaintenanceComodinTier;

// Etiquetas legibles para mostrar al usuario en qué nivel está actualmente
// (ver semaforo-info.tsx en el app).
export const TIER_LABELS: Record<ComodinTier, string> = {
  sobrepeso_1kg: "Sobrepeso",
  sobrepeso_10kg: "Sobrepeso alto",
  obesidad_20kg: "Obesidad",
  aumento_masa_5kg: "Aumento de masa",
  bajo_peso_10kg: "Bajo peso",
  desnutricion_15kg: "Desnutrición",
  estandar: "Estándar",
};

const HEALTHY_BMI_FLOOR = 18.5;
const HEALTHY_BMI_CEILING = 25;

export function computeMuscleGainTier(heightCm?: number | null, weightKg?: number | null): MuscleGainComodinTier {
  if (!heightCm || !weightKg) return "aumento_masa_5kg";

  const heightM = heightCm / 100;
  const minHealthyWeight = HEALTHY_BMI_FLOOR * heightM * heightM;
  const deficit = Math.max(0, minHealthyWeight - weightKg);

  if (deficit >= 15) return "desnutricion_15kg";
  if (deficit >= 10) return "bajo_peso_10kg";
  return "aumento_masa_5kg";
}

export function computeLowCarbTier(heightCm?: number | null, weightKg?: number | null): LowCarbComodinTier {
  if (!heightCm || !weightKg) return "sobrepeso_1kg";

  const heightM = heightCm / 100;
  const maxHealthyWeight = HEALTHY_BMI_CEILING * heightM * heightM;
  const excess = Math.max(0, weightKg - maxHealthyWeight);

  if (excess >= 20) return "obesidad_20kg";
  if (excess >= 10) return "sobrepeso_10kg";
  return "sobrepeso_1kg";
}

// Elige la función de tier correcta según la dieta del usuario (ver
// server/src/lib/dietGoal.ts para dietId).
export function computeComodinTier(
  dietId: string,
  heightCm?: number | null,
  weightKg?: number | null,
): ComodinTier {
  if (dietId === "lowcarb") return computeLowCarbTier(heightCm, weightKg);
  if (dietId === "muscle-gain") return computeMuscleGainTier(heightCm, weightKg);
  if (dietId === "maintenance") return "estandar";
  return "aumento_masa_5kg";
}
