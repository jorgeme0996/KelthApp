import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import * as routinesApi from "@/api/routines";
import { BODY_PART_LABELS } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

const RM_PERCENTAGE_TABLE: { reps: number; percent: number }[] = [
  { reps: 6, percent: 83 },
  { reps: 7, percent: 80 },
  { reps: 8, percent: 78 },
  { reps: 9, percent: 76 },
  { reps: 10, percent: 75 },
  { reps: 11, percent: 72 },
  { reps: 12, percent: 70 },
];

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rmInfoVisible, setRmInfoVisible] = useState(false);

  const { data: exercise, isLoading } = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => routinesApi.getExercise(id as string),
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

  if (!exercise) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No se encontró el ejercicio.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              style={styles.rmHeaderButton}
              hitSlop={8}
              onPress={() => setRmInfoVisible(true)}
            >
              <Text style={styles.rmHeaderText}>RM</Text>
              <Ionicons name="alert-circle-outline" size={20} color={colors.primaryDark} />
            </Pressable>
          ),
        }}
      />

      <Modal
        visible={rmInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRmInfoVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRmInfoVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>¿Qué es tu RM?</Text>
              <Pressable onPress={() => setRmInfoVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>
                En entrenamiento de fuerza, <Text style={styles.modalTextBold}>RM</Text> significa Repetición Máxima
                (Repetition Maximum). Es la mayor cantidad de peso que puedes levantar para un número específico de
                repeticiones manteniendo una técnica adecuada. Tu <Text style={styles.modalTextBold}>1RM</Text> es el
                peso máximo que puedes levantar en una sola repetición.
              </Text>

              <Text style={styles.modalSubtitle}>¿Cómo calcular tu 1RM?</Text>
              <Text style={styles.modalText}>
                1. Prueba directa: tras un buen calentamiento progresivo, sube el peso en series cortas hasta llegar
                a una sola repetición máxima con buena técnica, idealmente con alguien cerca que te asista.
              </Text>
              <Text style={styles.modalText}>
                2. Estimación: es más seguro que ir al fallo con cargas máximas. Haz una serie submáxima hasta el
                fallo técnico con un peso conocido y estima tu 1RM con la fórmula de Epley: 1RM ≈ peso × (1 +
                repeticiones ÷ 30), o usa directamente la tabla de abajo.
              </Text>

              <Text style={styles.modalSubtitle}>Tu 1RM — Entrenamiento hipertrofia</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.tableHeaderCell}>Reps</Text>
                  <Text style={styles.tableHeaderCell}>% de tu 1RM</Text>
                </View>
                {RM_PERCENTAGE_TABLE.map((row) => (
                  <View key={row.reps} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{row.reps}</Text>
                    <Text style={styles.tableCell}>{row.percent}%</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.modalFootnote}>
                Ejemplo: si tu 1RM en press de banca es 100 kg, para una serie de 10 repeticiones usarías
                aproximadamente 75 kg (75%).
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ScreenContainer scroll>
        <Text style={styles.title}>{exercise.name}</Text>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{BODY_PART_LABELS[exercise.bodyPart] ?? exercise.bodyPart}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{exercise.target}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{exercise.equipment}</Text>
          </View>
          {exercise.source === "ai_generated" ? (
            <View style={[styles.chip, styles.aiChip]}>
              <Text style={styles.aiChipText}>✨ Generado con IA</Text>
            </View>
          ) : null}
        </View>

        {exercise.gifUrl ? (
          <Image source={{ uri: exercise.gifUrl }} style={styles.media} contentFit="contain" />
        ) : (
          <View style={[styles.media, styles.mediaPlaceholder]}>
            <Text style={styles.mediaPlaceholderText}>Trabajando en la imagen/video</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Cómo hacerlo</Text>
        <View style={styles.card}>
          {exercise.instructionSteps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.attributionText}>{exercise.attribution}</Text>
      </ScreenContainer>
    </>
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
    textTransform: "capitalize",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    textTransform: "capitalize",
  },
  aiChip: {
    backgroundColor: colors.surfaceMuted,
  },
  aiChipText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  media: {
    width: "100%",
    height: 240,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
  },
  mediaPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPlaceholderText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
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
  attributionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  rmHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  rmHeaderText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  modalSubtitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  modalTextBold: {
    fontFamily: fonts.bold,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tableHeaderCell: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableCell: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  modalFootnote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
