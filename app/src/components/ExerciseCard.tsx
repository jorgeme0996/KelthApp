import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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

  // once the exercise for this slot changes (after a swap), keep the card disabled
  // until its new thumbnail actually finishes loading — skipped when there's no
  // image to load (e.g. an AI-generated exercise pending media backfill)
  const [awaitingImage, setAwaitingImage] = useState(false);
  const imageUrlRef = useRef(entry.exercise.imageUrl);
  useEffect(() => {
    if (imageUrlRef.current !== entry.exercise.imageUrl) {
      imageUrlRef.current = entry.exercise.imageUrl;
      setAwaitingImage(true);
    }
  }, [entry.exercise.imageUrl]);

  const busy = swapping || (awaitingImage && !!entry.exercise.imageUrl);

  return (
    <View style={[styles.card, busy && styles.cardSwapping]} pointerEvents={busy ? "none" : "auto"}>
      <View style={[styles.bodyPartBadge, { backgroundColor: bodyPartColor }]}>
        <Text style={styles.bodyPartBadgeText}>{BODY_PART_LABELS[entry.bodyPart] ?? entry.bodyPart}</Text>
        <View style={styles.bodyPartBadgeActions}>
          <Pressable
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: "/exercise-swap",
                params: { entryId: entry.id, bodyPart: entry.bodyPart, exerciseName: entry.exercise.name },
              })
            }
          >
            <Ionicons name="sparkles" size={18} color={colors.textOnPrimary} />
          </Pressable>
          {onSwap ? (
            <Pressable onPress={() => onSwap(entry.id)} disabled={busy} hitSlop={8}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Ionicons name="shuffle" size={18} color={colors.textOnPrimary} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable style={styles.body} onPress={() => router.push(`/exercise/${entry.exercise.id}`)}>
        {entry.exercise.imageUrl ? (
          <Image
            source={{ uri: entry.exercise.imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            onLoadEnd={() => setAwaitingImage(false)}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="image-outline" size={20} color={colors.textMuted} />
          </View>
        )}
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
  cardSwapping: {
    opacity: 0.5,
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
  bodyPartBadgeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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
