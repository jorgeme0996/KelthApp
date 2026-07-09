import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { MealsPerDaySelector } from "@/components/MealsPerDaySelector";
import { GenderSelector } from "@/components/GenderSelector";
import { SplitTypeSelector } from "@/components/SplitTypeSelector";
import { EquipmentSelector } from "@/components/EquipmentSelector";
import { DietaryRestrictionsSelector } from "@/components/DietaryRestrictionsSelector";
import { TrainingDaysSelector } from "@/components/TrainingDaysSelector";
import { useAuth } from "@/context/AuthContext";
import * as dietsApi from "@/api/diets";
import { ApiError } from "@/api/client";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { DietaryRestriction, Gender, SplitType, EquipmentPreference } from "@/types";

function flattenItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : (item as { name: string }).name));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).flatMap(flattenItems);
  }
  return [];
}

export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [mealsPerDay, setMealsPerDay] = useState(user?.mealsPerDay ?? 4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [trainingDays, setTrainingDays] = useState<number[]>(user?.trainingDays ?? []);
  const [savingTrainingDays, setSavingTrainingDays] = useState(false);
  const [trainingDaysError, setTrainingDaysError] = useState<string | null>(null);
  const [trainingDaysSaved, setTrainingDaysSaved] = useState(false);

  const [gender, setGender] = useState<Gender | null>((user?.gender as Gender) ?? null);
  const [savingGender, setSavingGender] = useState(false);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [genderSaved, setGenderSaved] = useState(false);

  const [splitType, setSplitType] = useState<SplitType>((user?.splitType as SplitType) ?? "fullbody");
  const [savingSplitType, setSavingSplitType] = useState(false);
  const [splitTypeError, setSplitTypeError] = useState<string | null>(null);
  const [splitTypeSaved, setSplitTypeSaved] = useState(false);

  const [equipmentPreference, setEquipmentPreference] = useState<EquipmentPreference>(
    (user?.equipmentPreference as EquipmentPreference) ?? "gym",
  );
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentSaved, setEquipmentSaved] = useState(false);

  const [dietaryRestrictions, setDietaryRestrictions] = useState<DietaryRestriction[]>(
    (user?.dietaryRestrictions as DietaryRestriction[]) ?? [],
  );
  const [savingRestrictions, setSavingRestrictions] = useState(false);
  const [restrictionsError, setRestrictionsError] = useState<string | null>(null);
  const [restrictionsSaved, setRestrictionsSaved] = useState(false);

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const { data: diet, isLoading: loadingDiet } = useQuery({
    queryKey: ["diet", user?.dietType],
    queryFn: () => dietsApi.getDiet(user?.dietType ?? "lowcarb"),
    enabled: !!user?.dietType,
  });

  const prohibitedItems = useMemo(() => (diet ? flattenItems(diet.prohibited) : []), [diet]);
  const freeProteins = diet?.free?.proteinas?.libres ?? [];
  const limitedProteins = diet?.free?.proteinas?.limitadas1xSemana ?? [];
  const freeVeggies = diet?.free?.verdurasCrudas?.items as string[] | undefined;

  const handleSaveMealsPerDay = async (value: number) => {
    setMealsPerDay(value);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateUser({ mealsPerDay: value });
      queryClient.invalidateQueries({ queryKey: ["mealplan"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTrainingDays = async (value: number[]) => {
    setTrainingDays(value);
    setTrainingDaysSaved(false);
    if (value.length < 3 || value.length > 5) {
      setTrainingDaysError(null);
      return;
    }
    setSavingTrainingDays(true);
    setTrainingDaysError(null);
    try {
      await updateUser({ trainingDays: value });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
      setTrainingDaysSaved(true);
    } catch (err) {
      setTrainingDaysError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSavingTrainingDays(false);
    }
  };

  const handleSaveGender = async (value: Gender) => {
    setGender(value);
    setSavingGender(true);
    setGenderError(null);
    setGenderSaved(false);
    try {
      await updateUser({ gender: value });
      setGenderSaved(true);
    } catch (err) {
      setGenderError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSavingGender(false);
    }
  };

  const handleSaveSplitType = async (value: SplitType) => {
    setSplitType(value);
    setSavingSplitType(true);
    setSplitTypeError(null);
    setSplitTypeSaved(false);
    try {
      await updateUser({ splitType: value });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
      setSplitTypeSaved(true);
    } catch (err) {
      setSplitTypeError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSavingSplitType(false);
    }
  };

  const handleSaveEquipment = async (value: EquipmentPreference) => {
    setEquipmentPreference(value);
    setSavingEquipment(true);
    setEquipmentError(null);
    setEquipmentSaved(false);
    try {
      await updateUser({ equipmentPreference: value });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
      setEquipmentSaved(true);
    } catch (err) {
      setEquipmentError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSavingEquipment(false);
    }
  };

  const handleSaveRestrictions = async (value: DietaryRestriction[]) => {
    setDietaryRestrictions(value);
    setSavingRestrictions(true);
    setRestrictionsError(null);
    setRestrictionsSaved(false);
    try {
      await updateUser({ dietaryRestrictions: value });
      queryClient.invalidateQueries({ queryKey: ["mealplan"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
      setRestrictionsSaved(true);
    } catch (err) {
      setRestrictionsError(err instanceof ApiError ? err.message : "No se pudo actualizar tu preferencia.");
    } finally {
      setSavingRestrictions(false);
    }
  };

  const handleSavePhone = async () => {
    setSavingPhone(true);
    setPhoneError(null);
    setPhoneSaved(false);
    try {
      await updateUser({ phone: phone.trim() });
      setPhoneSaved(true);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : "No se pudo actualizar tu teléfono.");
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Perfil</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>¿Cuántas veces al día comes?</Text>
      <MealsPerDaySelector value={mealsPerDay} onChange={handleSaveMealsPerDay} />
      {saving ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {saved && !saving ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>¿Qué días quieres entrenar?</Text>
      <TrainingDaysSelector value={trainingDays} onChange={handleSaveTrainingDays} />
      {savingTrainingDays ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {trainingDaysSaved && !savingTrainingDays ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {trainingDaysError ? <Text style={styles.errorText}>{trainingDaysError}</Text> : null}

      <Text style={styles.sectionTitle}>¿Cómo prefieres entrenar?</Text>
      <SplitTypeSelector value={splitType} onChange={handleSaveSplitType} />
      {savingSplitType ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {splitTypeSaved && !savingSplitType ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {splitTypeError ? <Text style={styles.errorText}>{splitTypeError}</Text> : null}

      <Text style={styles.sectionTitle}>¿Dónde vas a entrenar?</Text>
      <EquipmentSelector value={equipmentPreference} onChange={handleSaveEquipment} />
      {savingEquipment ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {equipmentSaved && !savingEquipment ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {equipmentError ? <Text style={styles.errorText}>{equipmentError}</Text> : null}

      <Text style={styles.sectionTitle}>¿Tienes alguna restricción alimentaria?</Text>
      <DietaryRestrictionsSelector value={dietaryRestrictions} onChange={handleSaveRestrictions} />
      {savingRestrictions ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {restrictionsSaved && !savingRestrictions ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {restrictionsError ? <Text style={styles.errorText}>{restrictionsError}</Text> : null}

      <Text style={styles.sectionTitle}>¿Cuál es tu género?</Text>
      <GenderSelector value={gender} onChange={handleSaveGender} />
      {savingGender ? <Text style={styles.helperText}>Guardando…</Text> : null}
      {genderSaved && !savingGender ? <Text style={styles.successText}>Preferencia actualizada.</Text> : null}
      {genderError ? <Text style={styles.errorText}>{genderError}</Text> : null}

      <Text style={styles.sectionTitle}>Teléfono</Text>
      <View style={styles.phoneRow}>
        <View style={styles.phoneField}>
          <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 dígitos" />
        </View>
        <Button label="Guardar" onPress={handleSavePhone} loading={savingPhone} style={styles.phoneButton} />
      </View>
      {phoneSaved && !savingPhone ? <Text style={styles.successText}>Teléfono actualizado.</Text> : null}
      {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

      <Text style={styles.sectionTitle}>Tu dieta: {diet?.name ?? "Low Carb"}</Text>
      {loadingDiet ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : diet ? (
        <View style={styles.card}>
          <Text style={styles.dietDescription}>{diet.description}</Text>

          <Text style={styles.subTitle}>Libre, come sin límite</Text>
          <View style={styles.chipsRow}>
            {freeVeggies?.slice(0, 8).map((item) => (
              <View key={item} style={[styles.chip, styles.chipFree]}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
            {freeProteins.slice(0, 6).map((item) => (
              <View key={item} style={[styles.chip, styles.chipFree]}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.subTitle}>Máximo 1 vez por semana</Text>
          <View style={styles.chipsRow}>
            {limitedProteins.map((item) => (
              <View key={item} style={[styles.chip, styles.chipModerate]}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.subTitle}>Evita</Text>
          <View style={styles.chipsRow}>
            {prohibitedItems.slice(0, 12).map((item) => (
              <View key={item} style={[styles.chip, styles.chipAvoid]}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sourceText}>Fuente: {diet.source}</Text>
        </View>
      ) : null}

      <Button label="Cerrar sesión" variant="secondary" onPress={() => logout()} style={{ marginTop: spacing.sm, marginBottom: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  phoneField: {
    flex: 1,
  },
  phoneButton: {
    marginTop: 2,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  helperText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  successText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  dietDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  subTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipFree: {
    backgroundColor: colors.primarySoft,
  },
  chipModerate: {
    backgroundColor: colors.accentSoft,
  },
  chipAvoid: {
    backgroundColor: colors.dangerSoft,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  sourceText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
