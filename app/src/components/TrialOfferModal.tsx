import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import * as billingApi from "@/api/billing";
import { ApiError } from "@/api/client";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

interface TrialOfferModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TrialOfferModal({ visible, onClose }: TrialOfferModalProps) {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      await billingApi.startTrial();
      await refreshUser();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo activar tu prueba gratis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>¿Quieres probar Premium gratis por 7 días?</Text>
          <Text style={styles.subtitle}>Sin tarjeta. Cancela cuando quieras desde tu perfil.</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button label="Probar 7 días gratis" onPress={handleAccept} loading={loading} style={{ marginTop: spacing.lg }} />
          <Button label="Ahora no" variant="ghost" onPress={onClose} disabled={loading} style={{ marginTop: spacing.sm }} />
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
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
