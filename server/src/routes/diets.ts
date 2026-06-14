import { Router } from "express";
import lowcarb from "../data/diets/lowcarb.json";

const router = Router();

const DIETS: Record<string, unknown> = {
  lowcarb,
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
