import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GOAL_OPTIONS, Goal } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface GoalSelectorProps {
  value: Goal | null;
  onChange: (value: Goal) => void;
}

export function GoalSelector({ value, onChange }: GoalSelectorProps) {
  return (
    <View style={styles.list}>
      {GOAL_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.75}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>
            <View style={styles.text}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  text: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  labelSelected: {
    color: colors.primaryDark,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
