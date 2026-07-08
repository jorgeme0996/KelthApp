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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/mealplans", mealPlanRoutes);
app.use("/api/diets", dietRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/exercises", exerciseRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`El Mejor Menú API escuchando en http://localhost:${PORT}`);
});
