import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function BillingSuccessScreen() {
  const { refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    // Stripe's webhook may land slightly after this redirect, so give it a
    // moment before pulling the updated subscription status.
    const timer = setTimeout(async () => {
      try {
        await refreshUser();
      } finally {
        setRefreshing(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [refreshUser]);

  return (
    <ScreenContainer>
      <Text style={styles.title}>¡Listo!</Text>
      <Text style={styles.text}>
        {refreshing ? "Confirmando tu suscripción…" : "Tu suscripción Premium ya está activa."}
      </Text>
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
