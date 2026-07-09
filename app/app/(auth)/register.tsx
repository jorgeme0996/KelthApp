import { useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { MealsPerDaySelector } from "@/components/MealsPerDaySelector";
import { GenderSelector } from "@/components/GenderSelector";
import { SplitTypeSelector } from "@/components/SplitTypeSelector";
import { EquipmentSelector } from "@/components/EquipmentSelector";
import { DietaryRestrictionsSelector } from "@/components/DietaryRestrictionsSelector";
import { TrainingDaysSelector } from "@/components/TrainingDaysSelector";
import { GoalSelector } from "@/components/GoalSelector";
import { GoalProjection } from "@/components/GoalProjection";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/client";
import { getPasswordError } from "@/utils/password";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { DietaryRestriction, Gender, Goal, SplitType, EquipmentPreference } from "@/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepId =
  | "name"
  | "email"
  | "phone"
  | "gender"
  | "age"
  | "height"
  | "weight"
  | "goal"
  | "meals"
  | "split"
  | "equipment"
  | "diet_restrictions"
  | "training_days"
  | "password";

const STEPS: StepId[] = [
  "name",
  "gender",
  "age",
  "height",
  "weight",
  "goal",
  "diet_restrictions",
  "meals",
  "phone",
  "split",
  "equipment",
  "training_days",
  "email",
  "password",
];

const STEP_META: Record<StepId, { question: string; helper?: string }> = {
  name: { question: "¿Cómo te llamas?" },
  gender: { question: "¿Cuál es tu género?" },
  age: { question: "¿Cuál es tu edad?" },
  height: { question: "¿Cuál es tu altura?" },
  weight: { question: "¿Cuál es tu peso?" },
  goal: { question: "¿Cuál es tu objetivo?" },
  diet_restrictions: { question: "¿Tienes alguna restricción alimentaria?", helper: "Puedes elegir varias, o ninguna." },
  meals: { question: "¿Cuántas veces al día quieres comer?", helper: "Incluye comidas principales y colaciones. Puedes cambiarlo después." },
  phone: {
    question: "Esto es lo que podrías lograr",
    helper: "Compártenos tu teléfono para activar a tu asistente personal, que te ayudará a cumplir tu objetivo. Nunca lo compartiremos.",
  },
  split: { question: "¿Cómo prefieres entrenar?" },
  equipment: { question: "¿Dónde vas a entrenar?" },
  training_days: { question: "¿Qué días quieres entrenar?", helper: "Elige entre 3 y 5 días a la semana." },
  email: { question: "¿Cuál es tu correo electrónico?", helper: "Es solo para recuperar tu cuenta e iniciar sesión. No lo compartiremos con nadie." },
  password: { question: "Crea tu contraseña", helper: "Debe incluir al menos una mayúscula y un carácter especial." },
};

export default function RegisterScreen() {
  const { register } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [splitType, setSplitType] = useState<SplitType>("fullbody");
  const [equipmentPreference, setEquipmentPreference] = useState<EquipmentPreference>("gym");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<DietaryRestriction[]>([]);
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepId = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const validateStep = (): string | null => {
    switch (stepId) {
      case "name":
        return name.trim() ? null : "Cuéntanos cómo te llamas.";
      case "email":
        return EMAIL_REGEX.test(email.trim()) ? null : "Ingresa un correo electrónico válido.";
      case "training_days":
        return trainingDays.length >= 3 && trainingDays.length <= 5 ? null : "Elige entre 3 y 5 días.";
      case "password":
        return getPasswordError(password);
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        mealsPerDay,
        age: age ? parseInt(age, 10) : undefined,
        heightCm: heightCm ? parseInt(heightCm, 10) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        goal: goal ?? undefined,
        phone: phone.trim() || undefined,
        gender: gender ?? undefined,
        splitType,
        equipmentPreference,
        dietaryRestrictions,
        trainingDays,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear tu cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const goNext = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (isLastStep) {
      await handleSubmit();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const meta = STEP_META[stepId];

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Personalizaremos tu plan semanal Low Carb.</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Paso {stepIndex + 1} de {STEPS.length}
      </Text>

      <View style={styles.form}>
        <Text style={styles.sectionLabel}>{meta.question}</Text>
        {meta.helper ? <Text style={styles.sectionHelper}>{meta.helper}</Text> : null}

        {stepId === "name" && (
          <TextField value={name} onChangeText={setName} placeholder="Tu nombre" autoFocus />
        )}

        {stepId === "email" && (
          <TextField
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tucorreo@ejemplo.com"
            autoFocus
          />
        )}

        {stepId === "phone" && (
          <>
            <GoalProjection goal={goal} weightKg={weightKg} mealsPerDay={mealsPerDay} />
            <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 dígitos" autoFocus />
          </>
        )}

        {stepId === "gender" && <GenderSelector value={gender} onChange={setGender} />}

        {stepId === "age" && (
          <TextField value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="años" autoFocus />
        )}

        {stepId === "height" && (
          <TextField value={heightCm} onChangeText={setHeightCm} keyboardType="number-pad" placeholder="cm" autoFocus />
        )}

        {stepId === "weight" && (
          <TextField value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="kg" autoFocus />
        )}

        {stepId === "goal" && <GoalSelector value={goal} onChange={setGoal} />}

        {stepId === "meals" && <MealsPerDaySelector value={mealsPerDay} onChange={setMealsPerDay} />}

        {stepId === "split" && <SplitTypeSelector value={splitType} onChange={setSplitType} />}

        {stepId === "equipment" && (
          <EquipmentSelector value={equipmentPreference} onChange={setEquipmentPreference} />
        )}

        {stepId === "diet_restrictions" && (
          <DietaryRestrictionsSelector value={dietaryRestrictions} onChange={setDietaryRestrictions} />
        )}

        {stepId === "training_days" && (
          <TrainingDaysSelector value={trainingDays} onChange={setTrainingDays} />
        )}

        {stepId === "password" && (
          <TextField value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8 caracteres" autoFocus />
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          {!isFirstStep && (
            <Button label="Atrás" variant="secondary" onPress={goBack} style={styles.backButton} />
          )}
          <Button
            label={isLastStep ? "Crear cuenta" : "Continuar"}
            onPress={goNext}
            loading={loading}
            style={styles.nextButton}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
        <Link href="/(auth)/login" style={styles.link}>
          Inicia sesión
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xxl,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionHelper: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  footer: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
});
