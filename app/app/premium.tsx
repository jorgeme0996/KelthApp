import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import * as billingApi from "@/api/billing";
import { ApiError } from "@/api/client";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";
import { isPremiumUser } from "@/types";

const PREMIUM_FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  {
    icon: "restaurant",
    title: "Menú semanal de tu tratamiento",
    description: "Recetas alineadas a tu objetivo, con el semáforo de tu tratamiento.",
  },
  {
    icon: "barbell",
    title: "Rutina de ejercicio personalizada",
    description: "Según tus días de entrenamiento y el equipo disponible.",
  },
  {
    icon: "cart",
    title: "Lista de compras automática",
    description: "Se genera sola a partir de tu menú semanal.",
  },
  {
    icon: "chatbubbles",
    title: "Preguntas ilimitadas al asistente",
    description: "Pregunta lo que necesites, cuando lo necesites, sin límite diario.",
  },
  {
    icon: "logo-whatsapp",
    title: "Asistente personal por WhatsApp",
    description: "Recibe recordatorios diarios y resuelve dudas directo desde WhatsApp.",
  },
  {
    icon: "infinite",
    title: "Cambios ilimitados",
    description: "Ajusta tu menú y tu rutina las veces que quieras cada semana.",
  },
];

export default function PremiumScreen() {
  const { user } = useAuth();
  const [billingLoading, setBillingLoading] = useState<"monthly" | "portal" | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const premium = isPremiumUser(user);

  const handleUpgrade = async (plan: "monthly") => {
    setBillingLoading(plan);
    setBillingError(null);
    try {
      const { url } = await billingApi.createCheckoutSession(plan);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setBillingError(err instanceof ApiError ? err.message : "No se pudo iniciar el pago.");
    } finally {
      setBillingLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setBillingLoading("portal");
    setBillingError(null);
    try {
      const { url } = await billingApi.createPortalSession();
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setBillingError(err instanceof ApiError ? err.message : "No se pudo abrir tu suscripción.");
    } finally {
      setBillingLoading(null);
    }
  };

  const planCards = (
    <>
      <View style={[styles.planCard, styles.planCardFeatured]}>
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>Mensual</Text>
          <Text style={styles.planPrice}>$1,899/mes</Text>
        </View>
        <Button
          label="Empezar mensual"
          onPress={() => handleUpgrade("monthly")}
          loading={billingLoading === "monthly"}
          disabled={billingLoading !== null}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <View style={styles.planCard}>
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>Anual</Text>
          <Text style={styles.planPriceMuted}>Próximamente</Text>
        </View>
      </View>

      {billingError ? <Text style={styles.errorText}>{billingError}</Text> : null}
    </>
  );

  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="star" size={28} color={colors.accent} />
        </View>
        <Text style={styles.title}>KelthApp Premium</Text>
        <Text style={styles.subtitle}>Todo lo que necesitas para llegar a tu objetivo, sin límites.</Text>
      </View>

      <Text style={styles.sectionTitle}>Qué incluye</Text>
      <View style={styles.premiumCard}>
        {PREMIUM_FEATURES.map((feature) => (
          <View key={feature.title} style={styles.premiumRow}>
            <View style={styles.premiumIcon}>
              <Ionicons name={feature.icon} size={20} color={colors.textOnPrimary} />
            </View>
            <View style={styles.premiumTextWrap}>
              <Text style={styles.premiumTitle}>{feature.title}</Text>
              <Text style={styles.premiumDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {premium ? (
        <View style={styles.card}>
          <Text style={styles.dietDescription}>
            Ya tienes Premium ({user?.subscriptionPlan === "annual" ? "anual" : "mensual"})
            {user?.currentPeriodEnd ? ` · se renueva el ${new Date(user.currentPeriodEnd).toLocaleDateString("es-MX")}` : ""}.
          </Text>
          <Button
            label="Administrar suscripción"
            variant="secondary"
            onPress={handleManageSubscription}
            loading={billingLoading === "portal"}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Elige tu plan</Text>
          {planCards}
          <Text style={styles.footerNote}>Pago seguro con Stripe. Cancela cuando quieras desde tu perfil.</Text>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  premiumCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  premiumRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  premiumIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumTextWrap: {
    flex: 1,
  },
  premiumTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textOnPrimary,
  },
  premiumDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
    lineHeight: 17,
  },
  dietDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  planCardFeatured: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  planPrice: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  planPriceMuted: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  footerNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});
