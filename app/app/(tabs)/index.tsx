import { useMemo, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { RecipeCard } from "@/components/RecipeCard";
import { ExerciseCard } from "@/components/ExerciseCard";
import { useAuth } from "@/context/AuthContext";
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useSwapMealEntry,
  useToggleMealEntryComplete,
} from "@/hooks/useMealPlan";
import {
  useCompleteWorkoutDay,
  useCurrentRoutine,
  useGenerateRoutine,
  useSwapRoutineEntry,
  useUncompleteWorkoutDay,
  useWorkoutCompletions,
} from "@/hooks/useRoutine";
import { ApiError } from "@/api/client";
import { isPremiumRequiredError } from "@/utils/apiErrors";
import { BODY_PART_ORDER, DAY_LABELS, MEAL_SLOT_ORDER } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { computeWorkoutStreak, dateKey, getWorkoutDoneTodayMessage } from "@/utils/workoutCongrats";

function getTodayDayIndex() {
  const jsDay = new Date().getDay(); // 0 = domingo
  return (jsDay + 6) % 7; // 0 = lunes ... 6 = domingo
}

type HomeTab = "food" | "exercise";

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<HomeTab>("food");
  const { user } = useAuth();
  const { data: mealPlan, isLoading } = useCurrentMealPlan();
  const generateMutation = useGenerateMealPlan();
  const swapMutation = useSwapMealEntry();
  const completeMutation = useToggleMealEntryComplete();

  const { data: routine } = useCurrentRoutine();
  const generateRoutineMutation = useGenerateRoutine();
  const swapRoutineMutation = useSwapRoutineEntry();
  const completeWorkoutMutation = useCompleteWorkoutDay();
  const uncompleteWorkoutMutation = useUncompleteWorkoutDay();
  const { data: completions } = useWorkoutCompletions();
  const [justCompletedNames, setJustCompletedNames] = useState<string[] | null>(null);

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

  const todayIndex = getTodayDayIndex();

  const todayEntries = useMemo(() => {
    if (!mealPlan) return [];
    return mealPlan.entries
      .filter((entry) => entry.dayIndex === todayIndex)
      .sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.mealSlot) - MEAL_SLOT_ORDER.indexOf(b.mealSlot));
  }, [mealPlan, todayIndex]);

  const todayWorkoutEntries = useMemo(() => {
    if (!routine) return [];
    return routine.entries
      .filter((entry) => entry.dayIndex === todayIndex)
      .sort((a, b) => BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart));
  }, [routine, todayIndex]);

  const todayKey = dateKey(new Date());

  const completedDateKeys = useMemo(() => {
    const keys = new Set((completions ?? []).map((c) => dateKey(new Date(c.completedAt))));
    if (justCompletedNames) keys.add(todayKey);
    return keys;
  }, [completions, justCompletedNames, todayKey]);

  const isWorkoutDoneToday = completedDateKeys.has(todayKey);
  const workoutStreak = useMemo(() => computeWorkoutStreak(completedDateKeys, new Date()), [completedDateKeys]);

  const todaysExerciseNames = useMemo(() => {
    if (justCompletedNames) return justCompletedNames;
    const todaysCompletion = completions?.find((c) => dateKey(new Date(c.completedAt)) === todayKey);
    if (todaysCompletion) return todaysCompletion.exerciseNames;
    return todayWorkoutEntries.map((entry) => entry.exercise.name);
  }, [justCompletedNames, completions, todayKey, todayWorkoutEntries]);

  const handleCompleteWorkout = () => {
    if (!routine || todayWorkoutEntries.length === 0) return;
    const exerciseNames = todayWorkoutEntries.map((entry) => entry.exercise.name);
    completeWorkoutMutation.mutate(
      { routineId: routine.id, dayIndex: todayIndex },
      {
        onSuccess: () => setJustCompletedNames(exerciseNames),
        onError: () => Alert.alert("Error", "No se pudo registrar tu entrenamiento. Intenta de nuevo."),
      }
    );
  };

  const handleUncompleteWorkout = () => {
    uncompleteWorkoutMutation.mutate(
      { dayIndex: todayIndex },
      {
        onSuccess: () => setJustCompletedNames(null),
        onError: () => Alert.alert("Error", "No se pudo actualizar tu entrenamiento. Intenta de nuevo."),
      }
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {user?.name?.split(" ")[0] ?? ""} 👋</Text>
        <Text style={styles.subtitle}>{DAY_LABELS[todayIndex]} · Plan Low Carb</Text>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === "food" && styles.tabButtonActive]}
          onPress={() => setActiveTab("food")}
        >
          <Text style={[styles.tabButtonText, activeTab === "food" && styles.tabButtonTextActive]}>🍽️ Comida</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "exercise" && styles.tabButtonActive]}
          onPress={() => setActiveTab("exercise")}
        >
          <Text style={[styles.tabButtonText, activeTab === "exercise" && styles.tabButtonTextActive]}>
            🏋️ Ejercicio
          </Text>
        </Pressable>
      </View>

      {activeTab === "food" ? (
        !mealPlan ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no tienes un menú semanal</Text>
            <Text style={styles.emptyText}>
              Genera tu plan de la semana con recetas mexicanas Low Carb y una lista de compras lista para usar.
            </Text>
            <Button
              label="Generar mi menú semanal"
              onPress={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              style={{ marginTop: spacing.md }}
            />
            {generateMutation.isError ? (
              <Text style={styles.errorText}>No se pudo generar el menú. Intenta de nuevo.</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hoy comes</Text>
            </View>

            {todayEntries.length === 0 ? (
              <Text style={styles.emptyText}>No hay comidas registradas para hoy.</Text>
            ) : (
              todayEntries.map((entry) => (
                <RecipeCard
                  key={entry.id}
                  entry={entry}
                  onSwap={(id) =>
                    swapMutation.mutate(id, {
                      onError: (err) => handlePremiumRequiredError(err, "No se pudo cambiar esta comida."),
                    })
                  }
                  swapping={swapMutation.isPending && swapMutation.variables === entry.id}
                  onToggleComplete={(id) => completeMutation.mutate(id)}
                  completing={completeMutation.isPending && completeMutation.variables === entry.id}
                />
              ))
            )}

            <View style={styles.linksRow}>
              <Button label="Ver menú semanal" variant="secondary" onPress={() => router.push("/(tabs)/menu")} />
            </View>
          </>
        )
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tu rutina de hoy</Text>
          </View>

          {!routine ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aún no tienes una rutina semanal</Text>
              <Text style={styles.emptyText}>Genera tu rutina de ejercicio de la semana.</Text>
              <Button
                label="Generar mi rutina semanal"
                onPress={() => generateRoutineMutation.mutate()}
                loading={generateRoutineMutation.isPending}
                style={{ marginTop: spacing.md }}
              />
              {generateRoutineMutation.isError ? (
                <Text style={styles.errorText}>No se pudo generar la rutina. Intenta de nuevo.</Text>
              ) : null}
            </View>
          ) : todayWorkoutEntries.length === 0 ? (
            <Text style={styles.emptyText}>Hoy es día de descanso.</Text>
          ) : isWorkoutDoneToday ? (
            <View style={styles.congratsCard}>
              <Text style={styles.congratsTitle}>¡Entrenamiento de hoy completado! 🎉</Text>
              <Text style={styles.congratsText}>
                {getWorkoutDoneTodayMessage(user?.name ?? "", todaysExerciseNames, workoutStreak)}
              </Text>
              <Button
                label="Ver rutina semanal"
                variant="secondary"
                onPress={() => router.push("/(tabs)/exercise")}
                style={{ marginTop: spacing.md }}
              />
              <Button
                label="Retomar entrenamiento"
                variant="ghost"
                onPress={handleUncompleteWorkout}
                loading={uncompleteWorkoutMutation.isPending}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          ) : (
            <>
              {todayWorkoutEntries.map((entry) => (
                <ExerciseCard
                  key={entry.id}
                  entry={entry}
                  onSwap={(id) =>
                    swapRoutineMutation.mutate(id, {
                      onError: (err) => handlePremiumRequiredError(err, "No se pudo cambiar este ejercicio."),
                    })
                  }
                  swapping={swapRoutineMutation.isPending && swapRoutineMutation.variables === entry.id}
                />
              ))}
              <Button
                label="Completar entrenamiento"
                onPress={handleCompleteWorkout}
                loading={completeWorkoutMutation.isPending}
                style={styles.completeButton}
              />

              <View style={styles.linksRow}>
                <Button
                  label="Ver rutina semanal"
                  variant="secondary"
                  onPress={() => router.push("/(tabs)/exercise")}
                />
              </View>
            </>
          )}
        </>
      )}

      <View style={styles.assistantCard}>
        <Text style={styles.assistantTitle}>¿Tienes dudas sobre tu dieta o tu rutina?</Text>
        <Text style={styles.assistantText}>Pregúntale a tu copiloto sobre sustituciones, porciones, ejercicios o tu plan de hoy.</Text>
        <Button label="Abrir asistente" variant="secondary" onPress={() => router.push("/(tabs)/chat")} />
      </View>
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
    marginBottom: spacing.lg,
  },
  greeting: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xxl,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  tabButtonTextActive: {
    color: colors.textOnPrimary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  linksRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  completeButton: {
    marginTop: spacing.sm,
  },
  congratsCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  congratsTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  congratsText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  assistantCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  assistantTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  assistantText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
