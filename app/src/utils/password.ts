export function getPasswordError(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password)) return "La contraseña debe tener al menos una letra mayúscula.";
  if (!/[^A-Za-z0-9]/.test(password)) return "La contraseña debe tener al menos un carácter especial.";
  return null;
}
