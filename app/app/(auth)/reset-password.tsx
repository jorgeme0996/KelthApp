import { useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ApiError } from "@/api/client";
import * as authApi from "@/api/auth";
import { getPasswordError } from "@/utils/password";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!token) {
      setError("El enlace no es válido. Solicita uno nuevo.");
      return;
    }
    const passwordError = getPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar tu contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Elige tu nueva contraseña</Text>
      </View>

      <View style={styles.form}>
        {done ? (
          <>
            <Text style={styles.successText}>
              Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
            </Text>
            <Button label="Ir a iniciar sesión" onPress={() => router.replace("/(auth)/login")} style={{ marginTop: spacing.md }} />
          </>
        ) : (
          <>
            <TextField
              label="Nueva contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mínimo 8 caracteres"
            />
            <Text style={styles.helperText}>
              Debe incluir al menos una mayúscula y un carácter especial.
            </Text>
            <TextField
              label="Confirma tu contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Cambiar contraseña" onPress={handleSubmit} loading={loading} />
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
    textAlign: "center",
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helperText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
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
