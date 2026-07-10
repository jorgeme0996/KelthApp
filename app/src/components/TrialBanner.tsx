import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface TrialBannerProps {
  daysLeft: number;
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const title = daysLeft <= 1 ? "¡Último día de tu prueba Premium!" : `Te quedan ${daysLeft} días de tu prueba Premium`;

  return (
    <Pressable style={styles.card} onPress={() => router.push("/premium")}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Preguntas ilimitadas, WhatsApp y cambios sin límite — todo incluido.</Text>
        <Text style={styles.cta}>Ver planes</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => setDismissed(true)}>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  textBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  cta: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  dismiss: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    padding: spacing.xs,
  },
});
