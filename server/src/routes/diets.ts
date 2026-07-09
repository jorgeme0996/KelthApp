import { Router } from "express";
import lowcarb from "../data/diets/lowcarb.json";
import maintenance from "../data/diets/maintenance.json";
import muscleGain from "../data/diets/muscle-gain.json";

const router = Router();

const DIETS: Record<string, unknown> = {
  lowcarb,
  maintenance,
  "muscle-gain": muscleGain,
};

router.get("/", (_req, res) => {
  res.json(Object.values(DIETS).map((d) => ({ id: (d as { id: string }).id, name: (d as { name: string }).name })));
});

router.get("/:id", (req, res) => {
  const diet = DIETS[req.params.id];
  if (!diet) return res.status(404).json({ error: "Dieta no encontrada" });
  res.json(diet);
});

export default router;
