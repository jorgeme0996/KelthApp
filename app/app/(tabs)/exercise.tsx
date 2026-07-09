import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { ExerciseCard } from "@/components/ExerciseCard";
import { useCurrentRoutine, useGenerateRoutine, useSwapRoutineEntry } from "@/hooks/useRoutine";
import { BODY_PART_ORDER, DAY_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

export default function ExerciseScreen() {
  const { data: routine, isLoading } = useCurrentRoutine();
  const generateMutation = useGenerateRoutine();
  const swapMutation = useSwapRoutineEntry();
  const [selectedDay, setSelectedDay] = useState(0);

  const dayEntries = useMemo(() => {
    if (!routine) return [];
    return routine.entries
      .filter((entry) => entry.dayIndex === selectedDay)
      .sort((a, b) => BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart));
  }, [routine, selectedDay]);

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
        <Button
          label="Regenerar"
          variant="ghost"
          onPress={() => generateMutation.mutate()}
          loading={generateMutation.isPending}
          style={styles.regenerateButton}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs} contentContainerStyle={styles.dayTabsContent}>
        {DAY_LABELS.map((label, index) => {
          const selected = index === selectedDay;
          return (
            <Pressable
              key={label}
              style={[styles.dayTab, selected && styles.dayTabSelected]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dayTabText, selected && styles.dayTabTextSelected]}>{label.slice(0, 3)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {dayEntries.map((entry) => (
          <ExerciseCard
            key={entry.id}
            entry={entry}
            onSwap={(id) => swapMutation.mutate(id)}
            swapping={swapMutation.isPending && swapMutation.variables === entry.id}
          />
        ))}
        {dayEntries.length === 0 ? <Text style={styles.emptyText}>Día de descanso.</Text> : null}
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
