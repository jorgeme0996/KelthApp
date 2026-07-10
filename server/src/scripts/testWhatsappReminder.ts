import { prisma } from "../prisma";
import {
  sendBreakfastReminders,
  sendLunchAndRoutineReminders,
  sendEveningWrapUp,
} from "../cron/whatsappReminders";

const TYPES = ["breakfast", "lunch", "evening", "all"] as const;
type ReminderType = (typeof TYPES)[number];

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
    console.error("Uso: npm run test:whatsapp -- --user=<email o id> [--type=breakfast|lunch|evening|all]");
    process.exit(1);
  }
  if (!TYPES.includes(type as ReminderType)) {
    console.error(`Tipo inválido "${type}". Usa uno de: ${TYPES.join(", ")}`);
    process.exit(1);
  }

  const user = await findUser(identifier);
  if (!user) {
    console.error(`No se encontró un usuario con id/email "${identifier}"`);
    process.exit(1);
  }
  if (!user.phone) {
    console.error(`El usuario ${user.email} no tiene teléfono configurado`);
    process.exit(1);
  }

  // force: true → ignora los checks de premium y de tareas ya completadas,
  // así el recordatorio siempre se envía sin tener que preparar datos de prueba.
  const options = { userId: user.id, force: true };
  const reminderType = type as ReminderType;

  if (reminderType === "breakfast" || reminderType === "all") {
    console.log(`Enviando recordatorio de desayuno a ${user.phone}...`);
    await sendBreakfastReminders(options);
  }
  if (reminderType === "lunch" || reminderType === "all") {
    console.log(`Enviando recordatorio de comida/rutina a ${user.phone}...`);
    await sendLunchAndRoutineReminders(options);
  }
  if (reminderType === "evening" || reminderType === "all") {
    console.log(`Enviando resumen nocturno a ${user.phone}...`);
    await sendEveningWrapUp(options);
  }

  console.log("Listo. Revisa el WhatsApp del usuario de prueba.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
