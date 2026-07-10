import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import mealPlanRoutes from "./routes/mealplans";
import dietRoutes from "./routes/diets";
import recipeRoutes from "./routes/recipes";
import chatRoutes from "./routes/chat";
import routineRoutes from "./routes/routines";
import exerciseRoutes from "./routes/exercises";
import billingRoutes, { stripeWebhookHandler } from "./routes/billing";
import whatsappWebhookRoutes from "./routes/whatsappWebhook";
import pushRoutes from "./routes/push";
import { registerPushCronJobs } from "./cron/pushReminders";
import { registerTrialReminderCronJob } from "./cron/trialReminders";
import { registerPlanExpirationCronJob } from "./cron/planExpiration";

const app = express();
app.use(cors({ origin: true }));

// Raw-body webhook routes must be mounted BEFORE express.json() so the
// exact bytes used for signature verification aren't consumed/reparsed.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use("/api/whatsapp", whatsappWebhookRoutes);

// 8mb to accommodate base64-encoded restaurant menu photos sent to the AI meal-swap chat.
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/mealplans", mealPlanRoutes);
app.use("/api/diets", dietRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/push", pushRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`El Mejor Menú API escuchando en http://localhost:${PORT}`);
  registerPushCronJobs();
  registerTrialReminderCronJob();
  registerPlanExpirationCronJob();
});
