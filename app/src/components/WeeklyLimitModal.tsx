import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface WeeklyLimitModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WeeklyLimitModal({ visible, onClose }: WeeklyLimitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Alcanzaste tu límite semanal de cambios. Actualiza a Premium para cambios ilimitados.</Text>
          <Button
            label="Hazte Premium"
            onPress={() => {
              onClose();
              router.push("/premium");
            }}
            style={{ marginTop: spacing.lg }}
          />
          <Button label="Cerrar" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
    textAlign: "center",
  },
});
