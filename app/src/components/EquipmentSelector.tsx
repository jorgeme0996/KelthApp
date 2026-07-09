import { Pressable, StyleSheet, Text, View } from "react-native";
import { EQUIPMENT_PREFERENCE_OPTIONS, EquipmentPreference } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface EquipmentSelectorProps {
  value: EquipmentPreference;
  onChange: (value: EquipmentPreference) => void;
}

export function EquipmentSelector({ value, onChange }: EquipmentSelectorProps) {
  return (
    <View style={styles.row}>
      {EQUIPMENT_PREFERENCE_OPTIONS.map((option) => {
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
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionLabel: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.md,
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
