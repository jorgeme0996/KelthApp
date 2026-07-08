import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken, authMiddleware, AuthRequest } from "../middleware/auth";
import { passwordSchema } from "../lib/password";
import { sendPasswordResetEmail } from "../services/mailer";

const router = Router();

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
const APP_SCHEME = process.env.APP_SCHEME || "elmejormenu";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  mealsPerDay: z.number().int().min(3).max(5).optional(),
  exerciseDaysPerWeek: z.number().int().min(3).max(5).optional(),
  age: z.number().int().min(1).max(120).optional(),
  heightCm: z.number().int().min(50).max(300).optional(),
  weightKg: z.number().min(10).max(500).optional(),
  goal: z.enum(["bajar_peso", "mantener_peso", "subir_masa"]).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const { email, password, name, mealsPerDay, exerciseDaysPerWeek, age, heightCm, weightKg, goal } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, mealsPerDay: mealsPerDay ?? 4, exerciseDaysPerWeek, age, heightCm, weightKg, goal },
  });

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: serializeUser(user),
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
    user: serializeUser(user),
  });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Si existe una cuenta con ese correo, enviamos instrucciones para restablecer tu contraseña.";

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const webUrl = `${APP_URL}/api/auth/reset-password?token=${rawToken}`;
    const appUrl = `${APP_SCHEME}://reset-password?token=${rawToken}`;
    try {
      const sent = await sendPasswordResetEmail(user.email, webUrl, appUrl);
      console.log(sent);
    } catch (err) {
      console.error("Error enviando correo de restablecimiento:", err);
    }
  }

  res.json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const passwordError = parsed.error.flatten().fieldErrors.password?.[0];
    return res.status(400).json({ error: passwordError || "Datos inválidos" });
  }
  const { token, password } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "El enlace no es válido o ya venció" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: "Tu contraseña se actualizó correctamente" });
});

router.get("/reset-password", (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const appUrl = `${APP_SCHEME}://reset-password?token=${encodeURIComponent(token)}`;

  res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Restablecer contraseña · El Mejor Menú</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FBF7F1; color: #33312E; margin: 0; padding: 24px; }
  .card { max-width: 400px; margin: 40px auto; background: #FFFFFF; border: 1px solid #E8E1D6; border-radius: 20px; padding: 28px; }
  h1 { font-size: 20px; color: #447A57; margin-top: 0; }
  p { font-size: 14px; color: #857F77; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 600; margin-top: 16px; margin-bottom: 6px; }
  input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #E8E1D6; font-size: 15px; }
  button { width: 100%; margin-top: 20px; padding: 13px; border: none; border-radius: 999px; background: #5FA777; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .app-link { display: inline-block; margin-top: 4px; font-size: 13px; color: #5FA777; text-decoration: none; font-weight: 600; }
  .msg { font-size: 14px; margin-top: 16px; }
  .msg.error { color: #E76F51; }
  .msg.success { color: #447A57; }
  .hint { font-size: 12px; color: #857F77; margin-top: 6px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Restablece tu contraseña</h1>
    <p>¿Tienes la app instalada? <a class="app-link" href="${appUrl}">Ábrela aquí</a> para cambiar tu contraseña ahí, o usa el formulario a continuación.</p>
    <form id="reset-form">
      <label for="password">Nueva contraseña</label>
      <input id="password" type="password" placeholder="••••••••" autocomplete="new-password" />
      <p class="hint">Mínimo 8 caracteres, con una mayúscula y un carácter especial.</p>
      <label for="confirm">Confirma tu contraseña</label>
      <input id="confirm" type="password" placeholder="••••••••" autocomplete="new-password" />
      <button type="submit">Cambiar contraseña</button>
      <div id="msg" class="msg"></div>
    </form>
  </div>
  <script>
    var token = ${JSON.stringify(token)};
    var form = document.getElementById("reset-form");
    var msg = document.getElementById("msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var password = document.getElementById("password").value;
      var confirm = document.getElementById("confirm").value;
      msg.className = "msg error";
      if (!token) {
        msg.textContent = "Enlace inválido. Solicita uno nuevo desde la app.";
        return;
      }
      if (password !== confirm) {
        msg.textContent = "Las contraseñas no coinciden.";
        return;
      }
      var button = form.querySelector("button");
      button.disabled = true;
      fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, password: password }),
      })
        .then(function (r) {
          return r.json().then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (res) {
          button.disabled = false;
          if (!res.ok) {
            msg.className = "msg error";
            msg.textContent = res.data.error || "No se pudo cambiar tu contraseña.";
            return;
          }
          msg.className = "msg success";
          msg.textContent = "Tu contraseña se actualizó. Ya puedes iniciar sesión en la app.";
          form.querySelector("button").style.display = "none";
        })
        .catch(function () {
          button.disabled = false;
          msg.className = "msg error";
          msg.textContent = "Ocurrió un error. Intenta de nuevo.";
        });
    });
  </script>
</body>
</html>`);
});

const serializeUser = (user: { id: string; email: string; name: string; mealsPerDay: number; exerciseDaysPerWeek: number | null; dietType: string; dailyChatLimit: number | null; age: number | null; heightCm: number | null; weightKg: number | null; goal: string | null }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  mealsPerDay: user.mealsPerDay,
  exerciseDaysPerWeek: user.exerciseDaysPerWeek,
  dietType: user.dietType,
  dailyChatLimit: user.dailyChatLimit,
  age: user.age,
  heightCm: user.heightCm,
  weightKg: user.weightKg,
  goal: user.goal,
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(serializeUser(user));
});

const updateMeSchema = z.object({
  mealsPerDay: z.number().int().min(3).max(5).optional(),
  exerciseDaysPerWeek: z.number().int().min(3).max(5).optional(),
  name: z.string().min(1).optional(),
  age: z.number().int().min(1).max(120).optional(),
  heightCm: z.number().int().min(50).max(300).optional(),
  weightKg: z.number().min(10).max(500).optional(),
  goal: z.enum(["bajar_peso", "mantener_peso", "subir_masa"]).optional(),
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
  res.json(serializeUser(user));
});

export default router;
