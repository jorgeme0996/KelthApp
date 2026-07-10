import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendPasswordResetEmail(to: string, webUrl: string, appUrl: string) {
  const from = process.env.MAIL_FROM || "El Mejor Menú <no-reply@elmejormenu.app>";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#447A57;">Recupera tu contraseña</h2>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en El Mejor Menú.</p>
      <p><a href="${appUrl}" style="color:#5FA777;">Abrir en la app</a></p>
      <p>O cambia tu contraseña desde tu navegador:</p>
      <p><a href="${webUrl}" style="background:#5FA777;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Cambiar contraseña</a></p>
      <p style="color:#857F77;font-size:13px;">Este enlace vence en 1 hora. Si tú no solicitaste este cambio, ignora este correo.</p>
    </div>
  `;

  const client = getTransporter();
  if (!client) {
    console.log(`[mailer] SMTP no configurado. Enlace de restablecimiento para ${to}: ${webUrl}`);
    return;
  }

  await client.sendMail({
    from,
    to,
    subject: "Restablece tu contraseña - El Mejor Menú",
    html,
  });
}

export async function sendTrialEndingEmail(to: string, name: string, daysLeft: number, appUrl: string) {
  const from = process.env.MAIL_FROM || "El Mejor Menú <no-reply@elmejormenu.app>";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#447A57;">Tu prueba Premium está por terminar</h2>
      <p>Hola ${name}, en ${daysLeft} día${daysLeft === 1 ? "" : "s"} tu acceso Premium gratuito llega a su fin.</p>
      <p>Sigue disfrutando preguntas ilimitadas al asistente, recordatorios por WhatsApp y cambios ilimitados a tu menú y rutina.</p>
      <p><a href="${appUrl}" style="background:#5FA777;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Suscríbete ahora</a></p>
    </div>
  `;

  const client = getTransporter();
  if (!client) {
    console.log(`[mailer] SMTP no configurado. Recordatorio de fin de prueba para ${to} (${daysLeft} días restantes).`);
    return;
  }

  await client.sendMail({
    from,
    to,
    subject: "Tu prueba Premium en El Mejor Menú termina pronto",
    html,
  });
}
