import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { TrialOfferModal } from "@/components/TrialOfferModal";
import { useAuth } from "@/context/AuthContext";
import { isTrialOfferEligible } from "@/types";
import { colors, fonts, fontSizes, spacing } from "@/theme";

export default function BillingCancelScreen() {
  const { user } = useAuth();
  // Destino del cancel_url de Stripe: en Android es aquí donde se detecta
  // que el usuario volvió del checkout sin comprar (en iOS ya se maneja al
  // resolver WebBrowser.openBrowserAsync en app/premium.tsx).
  const [trialOfferVisible, setTrialOfferVisible] = useState(isTrialOfferEligible(user));

  return (
    <>
      <ScreenContainer>
        <Text style={styles.title}>Pago cancelado</Text>
        <Text style={styles.text}>No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras desde tu perfil.</Text>
        <Button
          label="Volver a mi perfil"
          onPress={() => router.replace("/(tabs)/profile")}
          style={{ marginTop: spacing.lg }}
        />
      </ScreenContainer>
      <TrialOfferModal visible={trialOfferVisible} onClose={() => setTrialOfferVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
});
