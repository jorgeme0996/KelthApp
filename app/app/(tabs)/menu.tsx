import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { RecipeCard } from "@/components/RecipeCard";
import { MealPlanTutorialModal } from "@/components/MealPlanTutorialModal";
import { useCurrentMealPlan, useGenerateMealPlan, useRegenerateMealPlanDay, useSwapMealEntry } from "@/hooks/useMealPlan";
import { useMealPlanTutorial } from "@/hooks/useMealPlanTutorial";
import { ApiError } from "@/api/client";
import { isPremiumRequiredError } from "@/utils/apiErrors";
import { DAY_LABELS, MEAL_SLOT_ORDER } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

function getTodayIndex() {
  return (new Date().getDay() + 6) % 7;
}

export default function MenuScreen() {
  const { data: mealPlan, isLoading } = useCurrentMealPlan();
  const generateMutation = useGenerateMealPlan();
  const regenerateDayMutation = useRegenerateMealPlanDay();
  const swapMutation = useSwapMealEntry();
  const mealPlanTutorial = useMealPlanTutorial();
  const todayIndex = getTodayIndex();
  const [selectedDay, setSelectedDay] = useState(todayIndex);

  const handlePremiumRequiredError = (err: unknown, fallbackMessage: string) => {
    if (isPremiumRequiredError(err)) {
      Alert.alert("Función Premium", "Esta función requiere una suscripción Premium.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Ver planes", onPress: () => router.push("/premium") },
      ]);
      return;
    }
    Alert.alert("Error", err instanceof ApiError ? err.message : fallbackMessage);
  };

  const dayEntries = useMemo(() => {
    if (!mealPlan) return [];
    return mealPlan.entries
      .filter((entry) => entry.dayIndex === selectedDay)
      .sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.mealSlot) - MEAL_SLOT_ORDER.indexOf(b.mealSlot));
  }, [mealPlan, selectedDay]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!mealPlan) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aún no tienes un menú semanal</Text>
          <Text style={styles.emptyText}>Genera tu plan desde la pantalla de inicio.</Text>
          <Button
            label="Generar mi menú semanal"
            onPress={() =>
              generateMutation.mutate(undefined, { onSuccess: () => mealPlanTutorial.openIfFirstTime() })
            }
            loading={generateMutation.isPending}
            style={{ marginTop: spacing.md }}
          />
        </View>
        <MealPlanTutorialModal visible={mealPlanTutorial.visible} onClose={mealPlanTutorial.close} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Menú semanal</Text>
          <Pressable onPress={() => router.push("/semaforo-info")} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <Button
          label="Regenerar"
          variant="ghost"
          onPress={() =>
            regenerateDayMutation.mutate(
              { mealPlanId: mealPlan.id, dayIndex: selectedDay },
              {
                onError: (err) => handlePremiumRequiredError(err, "No se pudo regenerar el menú."),
              }
            )
          }
          loading={regenerateDayMutation.isPending}
          style={styles.regenerateButton}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs} contentContainerStyle={styles.dayTabsContent}>
        {DAY_LABELS.map((label, index) => {
          const selected = index === selectedDay;
          const isToday = index === todayIndex;
          return (
            <Pressable
              key={label}
              style={[styles.dayTab, selected && styles.dayTabSelected]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dayTabText, selected && styles.dayTabTextSelected]}>
                {label.slice(0, 3)}
                {isToday ? " •" : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {dayEntries.map((entry) => (
          <RecipeCard
            key={entry.id}
            entry={entry}
            onSwap={(id) =>
              swapMutation.mutate(id, {
                onError: (err) => handlePremiumRequiredError(err, "No se pudo cambiar esta comida."),
              })
            }
            swapping={swapMutation.isPending && swapMutation.variables === entry.id}
          />
        ))}
        {dayEntries.length === 0 ? <Text style={styles.emptyText}>No hay comidas para este día.</Text> : null}
      </ScrollView>

      <MealPlanTutorialModal visible={mealPlanTutorial.visible} onClose={mealPlanTutorial.close} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  regenerateButton: {
    height: "auto",
    paddingHorizontal: spacing.sm,
  },
  dayTabs: {
    marginBottom: spacing.md,
    flexGrow: 0,
  },
  dayTabsContent: {
    gap: spacing.xs,
  },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTabText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  dayTabTextSelected: {
    color: colors.textOnPrimary,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
});
