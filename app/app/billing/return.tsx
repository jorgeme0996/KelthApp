import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function BillingReturnScreen() {
  const { refreshUser } = useAuth();

  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  return (
    <ScreenContainer>
      <Text style={styles.title}>De vuelta en la app</Text>
      <Text style={styles.text}>Actualizamos tu suscripción con los últimos cambios.</Text>
      <Button
        label="Volver a mi perfil"
        onPress={() => router.replace("/(tabs)/profile")}
        style={{ marginTop: spacing.lg }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
});
