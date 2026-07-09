import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { RoutineEntry, BODY_PART_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, bodyPartColors, spacing } from "@/theme";

interface ExerciseCardProps {
  entry: RoutineEntry;
  onSwap?: (entryId: string) => void;
  swapping?: boolean;
  showHelp?: boolean;
}

export function ExerciseCard({ entry, onSwap, swapping, showHelp = true }: ExerciseCardProps) {
  const bodyPartColor = bodyPartColors[entry.bodyPart] ?? colors.primary;
  const detail = entry.durationSeconds
    ? `${Math.round(entry.durationSeconds / 60)} min`
    : `${entry.sets} x ${entry.reps}`;

  return (
    <View style={styles.card}>
      <View style={[styles.bodyPartBadge, { backgroundColor: bodyPartColor }]}>
        <Text style={styles.bodyPartBadgeText}>{BODY_PART_LABELS[entry.bodyPart] ?? entry.bodyPart}</Text>
        {onSwap ? (
          <Pressable onPress={() => onSwap(entry.id)} disabled={swapping} hitSlop={8}>
            <Ionicons name="shuffle" size={18} color={colors.textOnPrimary} style={{ opacity: swapping ? 0.5 : 1 }} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.body} onPress={() => router.push(`/exercise/${entry.exercise.id}`)}>
        <Image source={{ uri: entry.exercise.imageUrl }} style={styles.thumbnail} contentFit="cover" />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.exerciseName, styles.exerciseNameFlex]}>{entry.exercise.name}</Text>
            {showHelp ? (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/chat",
                    params: { type: "exercise", name: entry.exercise.name, id: entry.exercise.id },
                  })
                }
              >
                <Ionicons name="help-circle-outline" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.detailText}>{detail}</Text>
          <View style={styles.footer}>
            <Text style={styles.detailLink}>Ver ejercicio</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  bodyPartBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  bodyPartBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textOnPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.md,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  exerciseName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    textTransform: "capitalize",
  },
  exerciseNameFlex: {
    flex: 1,
  },
  detailText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailLink: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
});
