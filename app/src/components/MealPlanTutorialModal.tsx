import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { dietIdForGoal } from "@/types";
import { DIET_COLORS, SEMAFORO_CARDS } from "@/utils/semaforo";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface MealPlanTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MealPlanTutorialModal({ visible, onClose }: MealPlanTutorialModalProps) {
  const { user } = useAuth();
  const dietId = dietIdForGoal(user?.goal);
  const applicableColors = DIET_COLORS[dietId];
  const cards = SEMAFORO_CARDS.filter((card) => applicableColors.includes(card.color));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>¡Tu primer menú está listo! 🎉</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              Antes de empezar, así es como funciona tu menú y cómo puedes ajustarlo a tu día a día.
            </Text>

            <Text style={styles.sectionTitle}>El semáforo de tu plan</Text>
            <Text style={styles.sectionText}>
              Cada receta muestra chips de colores según el tipo de alimento que aporta.
            </Text>
            {cards.map((card) => (
              <View key={card.color} style={styles.semaforoCard}>
                <View style={[styles.dot, { backgroundColor: card.hex }]} />
                <View style={styles.semaforoCardText}>
                  <Text style={styles.semaforoCardTitle}>{card.title}</Text>
                  <Text style={styles.semaforoCardDescription}>{card.description}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Es una sugerencia, no una regla fija</Text>
            <Text style={styles.sectionText}>
              Tu copiloto de IA te puede ayudar a ajustar cualquier comida: dile qué tienes en el refri y te
              propondrá qué preparar, o si estás en un restaurante, te ayuda a elegir la mejor opción del menú.
            </Text>
          </ScrollView>

          <Button label="Entendido" onPress={onClose} style={styles.closeButton} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  semaforoCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    marginTop: 3,
  },
  semaforoCardText: {
    flex: 1,
  },
  semaforoCardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.text,
    marginBottom: 2,
  },
  semaforoCardDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  closeButton: {
    marginTop: spacing.md,
  },
});
