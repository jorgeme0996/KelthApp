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
import { isPremiumUser, isTrialOnly, trialDaysLeft } from "@/types";

const FREE_FEATURES = [
  "Plan de comidas semanal según tu objetivo",
  "Rutina de ejercicio según tus días de entrenamiento",
  "Lista de compras automática",
  "5 preguntas al asistente por día",
  "5 cambios a tu menú o rutina por semana",
];

const PREMIUM_FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
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
  {
    icon: "notifications",
    title: "Recordatorios diarios",
    description: "No se te olvida ni una comida ni un entrenamiento.",
  },
];

export default function PremiumScreen() {
  const { user } = useAuth();
  const [billingLoading, setBillingLoading] = useState<"monthly" | "annual" | "portal" | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const premium = isPremiumUser(user);
  const trialOnly = isTrialOnly(user);
  const daysLeft = trialDaysLeft(user);

  const handleUpgrade = async (plan: "monthly" | "annual") => {
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
      <View style={styles.planCard}>
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>Mensual</Text>
          <Text style={styles.planPrice}>$189/mes</Text>
        </View>
        <Button
          label="Empezar mensual"
          onPress={() => handleUpgrade("monthly")}
          loading={billingLoading === "monthly"}
          disabled={billingLoading !== null}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <View style={[styles.planCard, styles.planCardFeatured]}>
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsBadgeText}>Ahorra $369 al año</Text>
        </View>
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>Anual</Text>
          <Text style={styles.planPrice}>$1,899/año</Text>
        </View>
        <Button
          label="Empezar anual"
          onPress={() => handleUpgrade("annual")}
          loading={billingLoading === "annual"}
          disabled={billingLoading !== null}
          style={{ marginTop: spacing.sm }}
        />
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
        <Text style={styles.title}>ElMejorMenu Premium</Text>
        <Text style={styles.subtitle}>Todo lo que necesitas para llegar a tu objetivo, sin límites.</Text>
      </View>

      <Text style={styles.sectionTitle}>Incluido en tu plan gratis</Text>
      <View style={styles.card}>
        {FREE_FEATURES.map((feature) => (
          <View key={feature} style={styles.freeRow}>
            <Ionicons name="checkmark" size={18} color={colors.textMuted} />
            <Text style={styles.freeText}>{feature}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Con Premium desbloqueas</Text>
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

      {trialOnly ? (
        <>
          <View style={styles.card}>
            <Text style={styles.dietDescription}>
              Tu prueba Premium termina en {daysLeft} día{daysLeft === 1 ? "" : "s"} (
              {new Date(user!.trialEndsAt!).toLocaleDateString("es-MX")}). Suscríbete ahora para no perder el acceso a
              preguntas ilimitadas, WhatsApp y cambios sin límite.
            </Text>
          </View>
          <Text style={styles.sectionTitle}>Elige tu plan</Text>
          {planCards}
          <Text style={styles.footerNote}>Pago seguro con Stripe. Cancela cuando quieras desde tu perfil.</Text>
        </>
      ) : premium ? (
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
  freeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  freeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
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
  savingsBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  savingsBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
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
