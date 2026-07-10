import { prisma } from "../prisma";
import { regenerateExpiredMealPlans, regenerateExpiredRoutines } from "../cron/planExpiration";

const TYPES = ["mealplan", "routine", "all"] as const;
type RegenType = (typeof TYPES)[number];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    const match = args.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
  };
  return { user: get("user"), type: get("type") ?? "all" };
}

async function findUser(identifier: string) {
  return prisma.user.findFirst({ where: { OR: [{ id: identifier }, { email: identifier }] } });
}

async function main() {
  const { user: identifier, type } = parseArgs();

  if (!identifier) {
    console.error("Uso: npm run test:plan-expiration -- --user=<email o id> [--type=mealplan|routine|all]");
    process.exit(1);
  }
  if (!TYPES.includes(type as RegenType)) {
    console.error(`Tipo inválido "${type}". Usa uno de: ${TYPES.join(", ")}`);
    process.exit(1);
  }

  const user = await findUser(identifier);
  if (!user) {
    console.error(`No se encontró un usuario con id/email "${identifier}"`);
    process.exit(1);
  }

  // force: true → ignora el chequeo de expiración, así se puede regenerar
  // sin tener que esperar a que la semana/quincena realmente haya pasado.
  const options = { userId: user.id, force: true };
  const regenType = type as RegenType;

  if (regenType === "mealplan" || regenType === "all") {
    console.log(`Generando menú semanal para ${user.email}...`);
    await regenerateExpiredMealPlans(options);
  }
  if (regenType === "routine" || regenType === "all") {
    console.log(`Generando rutina para ${user.email}...`);
    await regenerateExpiredRoutines(options);
  }

  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
