import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import mealPlanRoutes from "./routes/mealplans";
import dietRoutes from "./routes/diets";
import recipeRoutes from "./routes/recipes";
import chatRoutes from "./routes/chat";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://el-mejor-menu--qqrfgmmftw.expo.app",
  "http://localhost:8081",
  "http://localhost:19006",
];

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : DEFAULT_ALLOWED_ORIGINS;

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (native apps, curl, server-to-server) are always allowed.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/mealplans", mealPlanRoutes);
app.use("/api/diets", dietRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`El Mejor Menú API escuchando en http://localhost:${PORT}`);
});
