import { Pressable, StyleSheet, Text, View } from "react-native";
import { WEEKDAY_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface TrainingDaysSelectorProps {
  value: number[];
  onChange: (value: number[]) => void;
}

const MAX_DAYS = 5;

export function TrainingDaysSelector({ value, onChange }: TrainingDaysSelectorProps) {
  const toggleDay = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day).sort((a, b) => a - b));
      return;
    }
    if (value.length >= MAX_DAYS) return;
    onChange([...value, day].sort((a, b) => a - b));
  };

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAY_LABELS.map((label, day) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              style={[styles.day, selected && styles.daySelected]}
            >
              <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.countLabel}>
        {value.length === 0 ? "Elige entre 3 y 5 días." : `${value.length} día${value.length === 1 ? "" : "s"} seleccionado${value.length === 1 ? "" : "s"}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  dayLabelSelected: {
    color: colors.primaryDark,
  },
  countLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
