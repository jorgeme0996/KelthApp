import { Pressable, StyleSheet, Text, View } from "react-native";
import { DIETARY_RESTRICTION_OPTIONS, DietaryRestriction } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface DietaryRestrictionsSelectorProps {
  value: DietaryRestriction[];
  onChange: (value: DietaryRestriction[]) => void;
}

export function DietaryRestrictionsSelector({ value, onChange }: DietaryRestrictionsSelectorProps) {
  const toggle = (restriction: DietaryRestriction) => {
    if (value.includes(restriction)) {
      onChange(value.filter((r) => r !== restriction));
      return;
    }
    onChange([...value, restriction]);
  };

  return (
    <View style={styles.wrap}>
      {DIETARY_RESTRICTION_OPTIONS.map((option) => {
        const selected = value.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => toggle(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
});
