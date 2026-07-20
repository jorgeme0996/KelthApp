/**
 * E2E: para cada objetivo (bajar_peso/mantener_peso/subir_masa) y varias
 * combinaciones de peso/talla que cruzan cada frontera de tier (ver
 * server/src/lib/comodinTier.ts), registra un usuario real vía HTTP,
 * genera su menú semanal, y verifica que:
 *   1. El tier que expone GET /api/mealplans/comodines-status es el que
 *      corresponde a ese peso/talla.
 *   2. El cupo semanal (cap) por color coincide con el definido en
 *      server/src/data/diets/*.json para ese tier.
 *   3. Los comodines "usados" en el menú realmente generado, recalculados
 *      de forma independiente a partir de las recetas y presupuestos
 *      diarios (sin reusar el código del generador), nunca exceden el cap.
 *
 * No usa un framework de test (no hay ninguno instalado en este repo, ver
 * src/scripts/testPlanExpiration.ts / testWhatsappReminder.ts para el mismo
 * patrón de script standalone). Pensado para correr contra una base de
 * datos Postgres desechable — ver server/scripts/run-e2e-comodines.sh.
 */
import request from "supertest";
import { app } from "../app";
import { prisma } from "../prisma";
import lowcarbRules from "../data/diets/lowcarb.json";
import maintenanceRules from "../data/diets/maintenance.json";
import muscleGainRules from "../data/diets/muscle-gain.json";

type Goal = "bajar_peso" | "mantener_peso" | "subir_masa";

type DietRules = {
  moderateEquivalents: Record<string, unknown>;
  mealSlotsByMealsPerDay: Record<string, string[]>;
  semaforo?: Record<string, string[]>;
};

const DIET_RULES_BY_GOAL: Record<Goal, DietRules> = {
  bajar_peso: lowcarbRules as DietRules,
  mantener_peso: maintenanceRules as DietRules,
  subir_masa: muscleGainRules as DietRules,
};

const MEALS_PER_DAY = 4;
const REPEATS_PER_CASE = 5; // el generador elige recetas al azar; repetir detecta violaciones intermitentes del cap

interface TierCase {
  label: string;
  goal: Goal;
  heightCm?: number;
  weightKg?: number;
  expectedTier: string;
  expectedTierLabel: string;
  expectedCaps: Record<string, number>;
}

// Altura de 200cm elegida para que el techo/piso saludable (BMI 25 / 18.5)
// caiga en números exactos en punto flotante (100.0 / 74.0kg): así los pesos
// "exactamente en la frontera" (ej. excess/deficit == 10, 15, 20) sobreviven
// intactos el viaje a través del conector de Postgres/Prisma (que trunca
// Float a ~15 dígitos significativos), en vez de perder el último bit y caer
// en el tier vecino por error de redondeo.
const TIER_CASES: TierCase[] = [
  // --- bajar_peso / lowcarb (techo saludable = 100kg a 200cm) ---
  {
    label: "lowcarb: exceso bajo (5kg)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 105,
    expectedTier: "sobrepeso_1kg",
    expectedTierLabel: "Sobrepeso",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },
  {
    label: "lowcarb: justo debajo de 10kg de exceso (9.9kg)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 109.9,
    expectedTier: "sobrepeso_1kg",
    expectedTierLabel: "Sobrepeso",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },
  {
    label: "lowcarb: exactamente 10kg de exceso (frontera)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 110,
    expectedTier: "sobrepeso_10kg",
    expectedTierLabel: "Sobrepeso alto",
    expectedCaps: { naranja: 4, amarillo: 3 },
  },
  {
    label: "lowcarb: exceso medio (15kg)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 115,
    expectedTier: "sobrepeso_10kg",
    expectedTierLabel: "Sobrepeso alto",
    expectedCaps: { naranja: 4, amarillo: 3 },
  },
  {
    label: "lowcarb: justo debajo de 20kg de exceso (19.9kg)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 119.9,
    expectedTier: "sobrepeso_10kg",
    expectedTierLabel: "Sobrepeso alto",
    expectedCaps: { naranja: 4, amarillo: 3 },
  },
  {
    label: "lowcarb: exactamente 20kg de exceso (frontera)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 120,
    expectedTier: "obesidad_20kg",
    expectedTierLabel: "Obesidad",
    expectedCaps: { naranja: 5, amarillo: 3 },
  },
  {
    label: "lowcarb: exceso alto (25kg)",
    goal: "bajar_peso",
    heightCm: 200,
    weightKg: 125,
    expectedTier: "obesidad_20kg",
    expectedTierLabel: "Obesidad",
    expectedCaps: { naranja: 5, amarillo: 3 },
  },
  {
    label: "lowcarb: sin peso/talla (fallback)",
    goal: "bajar_peso",
    expectedTier: "sobrepeso_1kg",
    expectedTierLabel: "Sobrepeso",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },

  // --- subir_masa / muscle-gain (piso saludable = 74kg a 200cm) ---
  {
    label: "muscle-gain: déficit bajo (5kg)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 69,
    expectedTier: "aumento_masa_5kg",
    expectedTierLabel: "Aumento de masa",
    expectedCaps: { naranja: 5, amarillo: 5, azul: 6 },
  },
  {
    label: "muscle-gain: justo debajo de 10kg de déficit (9.9kg)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 64.1,
    expectedTier: "aumento_masa_5kg",
    expectedTierLabel: "Aumento de masa",
    expectedCaps: { naranja: 5, amarillo: 5, azul: 6 },
  },
  {
    label: "muscle-gain: exactamente 10kg de déficit (frontera)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 64,
    expectedTier: "bajo_peso_10kg",
    expectedTierLabel: "Bajo peso",
    expectedCaps: { naranja: 6, amarillo: 6, azul: 7 },
  },
  {
    label: "muscle-gain: déficit medio (12kg)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 62,
    expectedTier: "bajo_peso_10kg",
    expectedTierLabel: "Bajo peso",
    expectedCaps: { naranja: 6, amarillo: 6, azul: 7 },
  },
  {
    label: "muscle-gain: justo debajo de 15kg de déficit (14.9kg)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 59.1,
    expectedTier: "bajo_peso_10kg",
    expectedTierLabel: "Bajo peso",
    expectedCaps: { naranja: 6, amarillo: 6, azul: 7 },
  },
  {
    label: "muscle-gain: exactamente 15kg de déficit (frontera)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 59,
    expectedTier: "desnutricion_15kg",
    expectedTierLabel: "Desnutrición",
    expectedCaps: { naranja: 7, amarillo: 7, azul: 8 },
  },
  {
    label: "muscle-gain: déficit alto (20kg)",
    goal: "subir_masa",
    heightCm: 200,
    weightKg: 54,
    expectedTier: "desnutricion_15kg",
    expectedTierLabel: "Desnutrición",
    expectedCaps: { naranja: 7, amarillo: 7, azul: 8 },
  },
  {
    label: "muscle-gain: sin peso/talla (fallback)",
    goal: "subir_masa",
    expectedTier: "aumento_masa_5kg",
    expectedTierLabel: "Aumento de masa",
    expectedCaps: { naranja: 5, amarillo: 5, azul: 6 },
  },

  // --- mantener_peso / maintenance (tier fijo, no depende del peso) ---
  {
    label: "maintenance: peso muy alto no cambia el tier",
    goal: "mantener_peso",
    heightCm: 170,
    weightKg: 200,
    expectedTier: "estandar",
    expectedTierLabel: "Estándar",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },
  {
    label: "maintenance: peso muy bajo no cambia el tier",
    goal: "mantener_peso",
    heightCm: 170,
    weightKg: 25,
    expectedTier: "estandar",
    expectedTierLabel: "Estándar",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },
  {
    label: "maintenance: sin peso/talla (fallback)",
    goal: "mantener_peso",
    expectedTier: "estandar",
    expectedTierLabel: "Estándar",
    expectedCaps: { naranja: 3, amarillo: 3 },
  },
];

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FALLÓ: ${message}`);
  }
}

function sortedJson(obj: Record<string, number>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))),
  );
}

async function registerTestUser(tc: TierCase) {
  const email = `e2e-comodines-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.local`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      email,
      password: "Test1234!",
      name: "E2E Comodines",
      mealsPerDay: MEALS_PER_DAY,
      goal: tc.goal,
      ...(tc.heightCm !== undefined ? { heightCm: tc.heightCm } : {}),
      ...(tc.weightKg !== undefined ? { weightKg: tc.weightKg } : {}),
    });
  if (res.status !== 201) {
    throw new Error(`No se pudo registrar usuario de prueba (${tc.label}): ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

// Recalcula, de forma independiente al generador (mealPlanGenerator.ts), cuántos
// comodines por color se "gastaron" en un menú ya generado: recorre cada día en
// el mismo orden de slots que usó el generador (dietRules.mealSlotsByMealsPerDay),
// acumulando equivalentes por categoría, y cuenta 1 comodín del color de la
// categoría cada vez que un platillo hace que el total del día exceda su
// dailyBudget normal.
function computeUsedIndependently(
  goal: Goal,
  entries: { dayIndex: number; mealSlot: string; recipe: { equivalents: Record<string, number> } }[],
): Record<string, number> {
  const dietRules = DIET_RULES_BY_GOAL[goal];
  const slots = dietRules.mealSlotsByMealsPerDay[String(MEALS_PER_DAY)] || dietRules.mealSlotsByMealsPerDay["4"];

  const budgets: Record<string, number> = {};
  for (const [category, def] of Object.entries(dietRules.moderateEquivalents)) {
    if (category === "_notes") continue;
    const typed = def as { dailyBudget?: number };
    if (typeof typed.dailyBudget === "number") budgets[category] = typed.dailyBudget;
  }

  const categoryColors: Record<string, string> = {};
  for (const [color, categories] of Object.entries(dietRules.semaforo ?? {})) {
    for (const category of categories) categoryColors[category] = color;
  }

  const byDay = new Map<number, { mealSlot: string; equivalents: Record<string, number> }[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.dayIndex) || [];
    list.push({ mealSlot: entry.mealSlot, equivalents: entry.recipe.equivalents || {} });
    byDay.set(entry.dayIndex, list);
  }

  const used: Record<string, number> = {};
  for (const dayEntries of byDay.values()) {
    dayEntries.sort((a, b) => slots.indexOf(a.mealSlot) - slots.indexOf(b.mealSlot));
    const dayTotals: Record<string, number> = {};
    for (const { equivalents } of dayEntries) {
      for (const [category, amount] of Object.entries(equivalents)) {
        const budget = budgets[category];
        const current = dayTotals[category] || 0;
        if (budget !== undefined && current + amount > budget) {
          const color = categoryColors[category];
          if (color) used[color] = (used[color] || 0) + 1;
        }
        dayTotals[category] = current + amount;
      }
    }
  }
  return used;
}

async function runTierCase(tc: TierCase, attempt: number) {
  const caseLabel = `${tc.label} [intento ${attempt}]`;
  const { token, userId } = await registerTestUser(tc);

  try {
    const genRes = await request(app)
      .post("/api/mealplans/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    check(genRes.status === 201, `${caseLabel}: POST /generate devolvió ${genRes.status}`);

    const statusRes = await request(app)
      .get("/api/mealplans/comodines-status")
      .set("Authorization", `Bearer ${token}`);
    check(statusRes.status === 200, `${caseLabel}: GET /comodines-status devolvió ${statusRes.status}`);

    check(
      statusRes.body.tier === tc.expectedTier,
      `${caseLabel}: tier esperado "${tc.expectedTier}", recibido "${statusRes.body.tier}"`,
    );
    check(
      statusRes.body.tierLabel === tc.expectedTierLabel,
      `${caseLabel}: tierLabel esperado "${tc.expectedTierLabel}", recibido "${statusRes.body.tierLabel}"`,
    );

    const caps: Record<string, number> = {};
    for (const c of statusRes.body.colors ?? []) caps[c.color] = c.cap;
    check(
      sortedJson(caps) === sortedJson(tc.expectedCaps),
      `${caseLabel}: caps esperados ${sortedJson(tc.expectedCaps)}, recibidos ${sortedJson(caps)}`,
    );

    const menuRes = await request(app).get("/api/mealplans/current").set("Authorization", `Bearer ${token}`);
    check(menuRes.status === 200, `${caseLabel}: GET /current devolvió ${menuRes.status}`);

    const independentUsed = computeUsedIndependently(tc.goal, menuRes.body.entries ?? []);

    for (const c of statusRes.body.colors ?? []) {
      const expectedUsed = independentUsed[c.color] || 0;
      check(
        c.used === expectedUsed,
        `${caseLabel}: color "${c.color}" used reportado por la API (${c.used}) no coincide con el recálculo independiente (${expectedUsed})`,
      );
      check(
        c.used <= c.cap,
        `${caseLabel}: color "${c.color}" usó ${c.used} comodines, por encima de su cap semanal (${c.cap})`,
      );
      check(
        c.remaining === Math.max(0, c.cap - c.used),
        `${caseLabel}: color "${c.color}" remaining (${c.remaining}) no es cap-used (${Math.max(0, c.cap - c.used)})`,
      );
    }
  } finally {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

async function main() {
  console.log(`Corriendo ${TIER_CASES.length} casos x ${REPEATS_PER_CASE} repeticiones...\n`);

  for (const tc of TIER_CASES) {
    console.log(`▶ ${tc.label}`);
    for (let attempt = 1; attempt <= REPEATS_PER_CASE; attempt++) {
      await runTierCase(tc, attempt);
    }
  }

  console.log(`\n${passed} verificaciones OK, ${failed} fallidas.`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
