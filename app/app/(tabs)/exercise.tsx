import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { ExerciseCard } from "@/components/ExerciseCard";
import { useAuth } from "@/context/AuthContext";
import {
  useCompleteWorkoutDay,
  useCurrentRoutine,
  useGenerateRoutine,
  useRegenerateRoutineDay,
  useSwapRoutineEntry,
  useWorkoutCompletions,
} from "@/hooks/useRoutine";
import { ApiError } from "@/api/client";
import { isPremiumRequiredError } from "@/utils/apiErrors";
import { BODY_PART_LABELS, BODY_PART_ORDER, DAY_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { getWorkoutCongratsMessage } from "@/utils/workoutCongrats";

function getTodayIndex() {
  return (new Date().getDay() + 6) % 7;
}

export default function ExerciseScreen() {
  const { user } = useAuth();
  const { data: routine, isLoading } = useCurrentRoutine();
  const generateMutation = useGenerateRoutine();
  const regenerateDayMutation = useRegenerateRoutineDay();
  const swapMutation = useSwapRoutineEntry();
  const completeMutation = useCompleteWorkoutDay();
  const { data: completions } = useWorkoutCompletions();
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
    if (!routine) return [];
    return routine.entries
      .filter((entry) => entry.dayIndex === selectedDay)
      .sort((a, b) => BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart));
  }, [routine, selectedDay]);

  const isSelectedDayCompleted = useMemo(() => {
    if (!routine || !completions) return false;
    return completions.some((c) => c.routineId === routine.id && c.dayIndex === selectedDay);
  }, [routine, completions, selectedDay]);

  const handleCompleteDay = () => {
    if (!routine || dayEntries.length === 0) return;
    const bodyParts = [...new Set(dayEntries.map((entry) => BODY_PART_LABELS[entry.bodyPart] ?? entry.bodyPart))].join(
      ", "
    );
    completeMutation.mutate(
      { routineId: routine.id, dayIndex: selectedDay },
      {
        onSuccess: () => {
          Alert.alert(
            "¡Entrenamiento completado!",
            getWorkoutCongratsMessage(user?.name ?? "", DAY_LABELS[selectedDay], bodyParts)
          );
        },
        onError: () => Alert.alert("Error", "No se pudo registrar tu entrenamiento. Intenta de nuevo."),
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

  if (!routine) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aún no tienes una rutina semanal</Text>
          <Text style={styles.emptyText}>Genera tu rutina de ejercicio de la semana.</Text>
          <Button
            label="Generar mi rutina semanal"
            onPress={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Rutina semanal</Text>
        {dayEntries.length > 0 ? (
          isSelectedDayCompleted ? (
            <Text style={styles.completedLabel}>Completado</Text>
          ) : (
            <View style={styles.headerActions}>
              <Button
                label="Adaptar con IA"
                variant="ghost"
                onPress={() => router.push({ pathname: "/routine-adapt", params: { routineId: routine.id } })}
                style={styles.regenerateButton}
              />
              <Button
                label="Regenerar"
                variant="ghost"
                onPress={() =>
                  regenerateDayMutation.mutate(
                    { routineId: routine.id, dayIndex: selectedDay },
                    {
                      onError: (err) => handlePremiumRequiredError(err, "No se pudo regenerar el entrenamiento."),
                    }
                  )
                }
                loading={regenerateDayMutation.isPending}
                style={styles.regenerateButton}
              />
            </View>
          )
        ) : null}
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
          <ExerciseCard
            key={entry.id}
            entry={entry}
            onSwap={(id) =>
              swapMutation.mutate(id, {
                onError: (err) => handlePremiumRequiredError(err, "No se pudo cambiar este ejercicio."),
              })
            }
            swapping={swapMutation.isPending && swapMutation.variables === entry.id}
            showHelp={selectedDay === todayIndex}
          />
        ))}
        {dayEntries.length === 0 ? <Text style={styles.emptyText}>Día de descanso.</Text> : null}

        {dayEntries.length > 0 && selectedDay === todayIndex && !isSelectedDayCompleted ? (
          <Button
            label="Completar entrenamiento"
            onPress={handleCompleteDay}
            loading={completeMutation.isPending}
            style={styles.completeButton}
          />
        ) : null}
      </ScrollView>
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
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  regenerateButton: {
    height: "auto",
    paddingHorizontal: spacing.sm,
  },
  completedLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
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
  completeButton: {
    marginTop: spacing.sm,
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
