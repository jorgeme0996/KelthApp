import { useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/client";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>KelthApp</Text>
        <Text style={styles.subtitle}>Tu plan semanal y lista de compras, a la mexicana.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Inicia sesión</Text>
        <TextField
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tucorreo@ejemplo.com"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label="Entrar" onPress={handleSubmit} loading={loading} />
        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          ¿Olvidaste tu contraseña?
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tienes cuenta?</Text>
        <Link href="/(auth)/register" style={styles.link}>
          Crea una aquí
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xxl,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  forgotLink: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    textAlign: "center",
    marginTop: spacing.md,
  },
  footer: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
});
