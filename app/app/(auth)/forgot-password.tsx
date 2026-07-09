import { useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ApiError } from "@/api/client";
import * as authApi from "@/api/auth";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email) {
      setError("Ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el correo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Recupera tu contraseña</Text>
        <Text style={styles.subtitle}>
          Te enviaremos un enlace a tu correo para que puedas cambiarla.
        </Text>
      </View>

      <View style={styles.form}>
        {sent ? (
          <Text style={styles.successText}>
            Si existe una cuenta con ese correo, te enviamos instrucciones para
            restablecer tu contraseña. Revisa tu bandeja de entrada.
          </Text>
        ) : (
          <>
            <TextField
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="tucorreo@ejemplo.com"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Enviar enlace" onPress={handleSubmit} loading={loading} />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Link href="/(auth)/login" style={styles.link}>
          Volver a iniciar sesión
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
    fontSize: fontSizes.xl,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
    textAlign: "center",
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
  successText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
});
