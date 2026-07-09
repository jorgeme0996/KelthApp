import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface MealsPerDaySelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const OPTIONS = [
  { value: 3, label: "3", helper: "Desayuno, comida y cena" },
  { value: 4, label: "4", helper: "+ una colación" },
  { value: 5, label: "5", helper: "+ dos colaciones" },
];

export function MealsPerDaySelector({ value, onChange }: MealsPerDaySelectorProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
            <Text style={[styles.optionHelper, selected && styles.optionHelperSelected]}>{option.helper}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionLabel: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  optionLabelSelected: {
    color: colors.primaryDark,
  },
  optionHelper: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  optionHelperSelected: {
    color: colors.primaryDark,
  },
});
