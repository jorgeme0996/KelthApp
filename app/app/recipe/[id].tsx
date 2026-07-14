import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import * as mealplansApi from "@/api/mealplans";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { semaforoColorHex } from "@/utils/semaforo";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => mealplansApi.getRecipe(id as string),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!recipe) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No se encontró la receta.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{recipe.name}</Text>

      {recipe.prepTimeMinutes ? (
        <View style={styles.prepTimeRow}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.prepTimeText}>{recipe.prepTimeMinutes} min de preparación</Text>
        </View>
      ) : null}

      <View style={styles.equivalentsRow}>
        {recipe.semaforo.map(({ category, color, label }) => {
          const hex = semaforoColorHex(color);
          return (
            <View key={category} style={[styles.equivalentChip, hex ? { backgroundColor: `${hex}1A` } : null]}>
              <Text style={[styles.equivalentChipText, hex ? { color: hex } : null]}>
                {recipe.equivalents[category]} {label}
              </Text>
            </View>
          );
        })}
      </View>

      <Pressable onPress={() => router.push("/semaforo-info")} style={styles.semaforoLinkRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
        <Text style={styles.semaforoLinkText}>¿Qué significan los colores?</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Ingredientes</Text>
      <View style={styles.card}>
        {recipe.ingredients.map((ing, index) => (
          <Text key={`${ing.name}-${index}`} style={styles.ingredientText}>
            • {ing.qty} {ing.unit} {ing.name}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Preparación</Text>
      <View style={styles.card}>
        {recipe.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {recipe.weeklyLimited ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            Esta receta incluye una proteína de consumo limitado a una vez por semana (res, cerdo o mariscos).
          </Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  prepTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.md,
  },
  prepTimeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  equivalentsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  equivalentChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  equivalentChipText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  semaforoLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.lg,
  },
  semaforoLinkText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  ingredientText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textOnPrimary,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  noteCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
