import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { Goal } from "@/types";

interface GoalProjectionProps {
  goal: Goal | null;
  weightKg: string;
  mealsPerDay: number;
}

const WEEKS = [0, 2, 4, 6, 8];
const CHART_HEIGHT = 90;
const MIN_BAR_HEIGHT = 18;

const WEEKLY_LOSS_RATE = 0.0075; // ~0.75% del peso corporal por semana, déficit moderado
const MONTHLY_GAIN_RATE = 0.01; // ~1% del peso corporal por mes, ganancia típica de principiante

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

export function GoalProjection({ goal, weightKg, mealsPerDay }: GoalProjectionProps) {
  const weight = parseFloat(weightKg);
  const hasWeight = !Number.isNaN(weight) && weight > 0;

  if (goal === "mantener_peso") {
    const totalMeals = mealsPerDay * 7 * 8;
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>≈{totalMeals} comidas balanceadas</Text>
        <Text style={styles.subtext}>en las próximas 8 semanas, construyendo mejores hábitos y más energía.</Text>
        <Text style={styles.disclaimer}>Estimado aproximado, no es un consejo médico.</Text>
      </View>
    );
  }

  if ((goal === "bajar_peso" || goal === "subir_masa") && hasWeight) {
    const isLoss = goal === "bajar_peso";
    const weeklyDelta = isLoss ? weight * WEEKLY_LOSS_RATE : (weight * MONTHLY_GAIN_RATE) / 4;
    const values = WEEKS.map((w) => Math.max(0, weight + (isLoss ? -1 : 1) * weeklyDelta * w));
    const totalDelta = values[values.length - 1] - values[0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return (
      <View style={styles.card}>
        <Text style={styles.headline}>
          {totalDelta >= 0 ? "+" : ""}
          {formatKg(totalDelta)} {isLoss ? "en 8 semanas" : "de músculo en 8 semanas"}
        </Text>
        <View style={styles.chartRow}>
          {values.map((value, i) => {
            const barHeight = MIN_BAR_HEIGHT + ((value - min) / range) * (CHART_HEIGHT - MIN_BAR_HEIGHT);
            return (
              <View key={WEEKS[i]} style={styles.barColumn}>
                <Text style={styles.barValue}>{value.toFixed(1)}</Text>
                <View style={[styles.bar, { height: barHeight }]} />
                <Text style={styles.barLabel}>Sem {WEEKS[i]}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>Estimado aproximado; varía según tu consistencia. No es un consejo médico.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.headline}>Tu plan personalizado está listo</Text>
      <Text style={styles.subtext}>Con estos datos armaremos tu progreso semana a semana.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headline: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  subtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  barValue: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  bar: {
    width: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  barLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
});
