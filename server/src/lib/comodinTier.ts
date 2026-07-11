// Nivel de comodines para la dieta de ganancia de masa muscular, derivado del
// IMC: qué tan por debajo del piso de peso saludable (IMC 18.5) está el
// paciente determina cuántas concesiones semanales por color se le otorgan
// (ver `comodines` en server/src/data/diets/muscle-gain.json).
export type ComodinTier = "desnutricion_15kg" | "bajo_peso_10kg" | "aumento_masa_5kg";

const HEALTHY_BMI_FLOOR = 18.5;

export function computeMuscleGainTier(heightCm?: number | null, weightKg?: number | null): ComodinTier {
  if (!heightCm || !weightKg) return "aumento_masa_5kg";

  const heightM = heightCm / 100;
  const minHealthyWeight = HEALTHY_BMI_FLOOR * heightM * heightM;
  const deficit = Math.max(0, minHealthyWeight - weightKg);

  if (deficit >= 15) return "desnutricion_15kg";
  if (deficit >= 10) return "bajo_peso_10kg";
  return "aumento_masa_5kg";
}
