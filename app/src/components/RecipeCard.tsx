import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { MealPlanEntry, MEAL_SLOT_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, slotColors, spacing } from "@/theme";

interface RecipeCardProps {
  entry: MealPlanEntry;
  onSwap?: (entryId: string) => void;
  swapping?: boolean;
  onToggleComplete?: (entryId: string) => void;
  completing?: boolean;
}

export function RecipeCard({ entry, onSwap, swapping, onToggleComplete, completing }: RecipeCardProps) {
  const slotColor = slotColors[entry.mealSlot] ?? colors.primary;
  const isCompleted = !!entry.completedAt;

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={[styles.slotBadge, { backgroundColor: slotColor }]}>
        <Text style={styles.slotBadgeText}>{MEAL_SLOT_LABELS[entry.mealSlot] ?? entry.mealSlot}</Text>
        {onSwap ? (
          <Pressable onPress={() => onSwap(entry.id)} disabled={swapping} hitSlop={8}>
            <Ionicons name="shuffle" size={18} color={colors.textOnPrimary} style={{ opacity: swapping ? 0.5 : 1 }} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.body} onPress={() => router.push(`/recipe/${entry.recipe.id}`)}>
        <View style={styles.titleRow}>
          {onToggleComplete ? (
            <Pressable
              onPress={() => onToggleComplete(entry.id)}
              disabled={completing}
              hitSlop={8}
              style={[styles.checkbox, isCompleted && styles.checkboxChecked, { opacity: completing ? 0.5 : 1 }]}
            >
              {isCompleted ? <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} /> : null}
            </Pressable>
          ) : null}
          <Text style={[styles.recipeName, isCompleted && styles.recipeNameCompleted]}>{entry.recipe.name}</Text>
          <Pressable
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/chat",
                params: { type: "meal", name: entry.recipe.name, id: entry.recipe.id },
              })
            }
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.equivalentsRow}>
          {entry.recipe.prepTimeMinutes ? (
            <View style={styles.equivalentChip}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.equivalentChipText}> {entry.recipe.prepTimeMinutes} min</Text>
            </View>
          ) : null}
          {Object.entries(entry.recipe.equivalents).map(([key, value]) => (
            <View key={key} style={styles.equivalentChip}>
              <Text style={styles.equivalentChipText}>
                {value} {key}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.detailLink}>Ver receta</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
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
  cardCompleted: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  recipeNameCompleted: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  slotBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  slotBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textOnPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: {
    padding: spacing.md,
  },
  recipeName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  equivalentsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  equivalentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  equivalentChipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
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
  swapButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
