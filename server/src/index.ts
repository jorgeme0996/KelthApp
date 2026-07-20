import "dotenv/config";
import { app } from "./app";
import { registerWhatsappCronJobs } from "./cron/whatsappReminders";
import { registerPlanExpirationCronJob } from "./cron/planExpiration";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`KelthApp API escuchando en http://localhost:${PORT}`);
  registerWhatsappCronJobs();
  registerPlanExpirationCronJob();
});
