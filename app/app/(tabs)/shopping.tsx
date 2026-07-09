import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useCurrentMealPlan, useShoppingList } from "@/hooks/useMealPlan";
import { ShoppingListItem } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

function formatQty(qty: number) {
  return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, "");
}

function ShoppingItem({ item }: { item: ShoppingListItem }) {
  const [checked, setChecked] = useState(false);

  return (
    <Pressable style={styles.item} onPress={() => setChecked((prev) => !prev)}>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={22}
        color={checked ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.itemText, checked && styles.itemTextChecked]}>
        {item.name} — {formatQty(item.qty)} {item.unit}
      </Text>
    </Pressable>
  );
}

export default function ShoppingScreen() {
  const { data: mealPlan, isLoading: loadingPlan } = useCurrentMealPlan();
  const { data: shoppingList, isLoading: loadingList } = useShoppingList(mealPlan?.id);

  if (loadingPlan || (mealPlan && loadingList)) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!mealPlan || !shoppingList) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aún no hay lista de compras</Text>
          <Text style={styles.emptyText}>Genera tu menú semanal desde la pantalla de inicio para crear tu lista.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const sections = Object.entries(shoppingList.sections).filter(([, items]) => items.length > 0);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Lista de compras</Text>
      <Text style={styles.subtitle}>Basada en tu menú de la semana</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {sections.map(([category, items]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            {items.map((item) => (
              <ShoppingItem key={`${item.name}-${item.unit}`} item={item} />
            ))}
          </View>
        ))}
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
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    flex: 1,
  },
  itemTextChecked: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
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
