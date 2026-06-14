import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken, authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  mealsPerDay: z.number().int().min(3).max(5).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const { email, password, name, mealsPerDay } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, mealsPerDay: mealsPerDay ?? 4 },
  });

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, mealsPerDay: user.mealsPerDay, dietType: user.dietType },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, mealsPerDay: user.mealsPerDay, dietType: user.dietType },
  });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ id: user.id, email: user.email, name: user.name, mealsPerDay: user.mealsPerDay, dietType: user.dietType });
});

const updateMeSchema = z.object({
  mealsPerDay: z.number().int().min(3).max(5).optional(),
  name: z.string().min(1).optional(),
});

router.patch("/me", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
  });
  res.json({ id: user.id, email: user.email, name: user.name, mealsPerDay: user.mealsPerDay, dietType: user.dietType });
});

export default router;
