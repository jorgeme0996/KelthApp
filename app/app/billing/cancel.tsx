import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function BillingCancelScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Pago cancelado</Text>
      <Text style={styles.text}>No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras desde tu perfil.</Text>
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
