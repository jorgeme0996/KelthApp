import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, fonts, fontSizes, radii, semaforo, spacing } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useComodinesStatus } from "@/hooks/useMealPlan";
import { dietIdForGoal } from "@/types";
import { DIET_COLORS, SEMAFORO_CARDS } from "@/utils/semaforo";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function SemaforoInfoScreen() {
  const { user } = useAuth();
  const dietId = dietIdForGoal(user?.goal);
  const applicableColors = DIET_COLORS[dietId];
  const cards = SEMAFORO_CARDS.filter((card) => applicableColors.includes(card.color));
  const { data: comodinStatus, isLoading: isLoadingComodines } = useComodinesStatus();

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>El semáforo de tu tratamiento</Text>
      <Text style={styles.subtitle}>
        Cada receta muestra chips de colores según el tipo de alimento que aporta. Así sabes de un vistazo qué tan
        alineada está con tu tratamiento.
      </Text>

      {cards.map((card) => (
        <View key={card.color} style={styles.card}>
          <View style={[styles.dot, { backgroundColor: card.hex }]} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </View>
        </View>
      ))}

      {isLoadingComodines ? (
        <View style={[styles.comodinCard, styles.comodinLoading]}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : comodinStatus && comodinStatus.colors.length > 0 ? (
        <View style={styles.comodinCard}>
          <View style={styles.comodinHeader}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.comodinTitle}>¿Qué son los "comodines"?</Text>
          </View>
          <Text style={styles.comodinText}>
            Cada semana tienes un cupo extra de excepciones por color para los días en que te pases un poco de tu
            porción normal — así tu menú se ajusta sin salirte por completo del tratamiento.
          </Text>
          <Text style={styles.comodinTier}>Tu nivel actual: {comodinStatus.tierLabel}</Text>
          <View style={styles.comodinChips}>
            {comodinStatus.colors.map((c) => (
              <View key={c.color} style={styles.comodinChip}>
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: semaforo[c.color as keyof typeof semaforo] ?? colors.border },
                  ]}
                />
                <Text style={styles.comodinChipText}>
                  {capitalize(c.color)}: {c.remaining}/{c.cap} restantes
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.full,
    marginTop: 3,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
  comodinCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  comodinHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  comodinTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
  comodinText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  comodinLoading: {
    alignItems: "center",
  },
  comodinTier: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  comodinChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  comodinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  comodinChipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
});
