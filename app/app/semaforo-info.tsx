import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, fonts, fontSizes, radii, semaforo, spacing } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { DietId, dietIdForGoal } from "@/types";

// Colores que cada dieta realmente usa hoy (ver server/src/data/diets/*.json
// `semaforo`). lowcarb y maintenance tienen naranja/amarillo (sin azul, ya
// que ahí las proteínas son libres) — maintenance es el mismo plan que
// lowcarb, solo menos restrictivo; muscle-gain tiene naranja/amarillo/azul.
const DIET_COLORS: Record<DietId, string[]> = {
  lowcarb: ["rojo", "naranja", "amarillo", "libre"],
  maintenance: ["rojo", "naranja", "amarillo", "libre"],
  "muscle-gain": ["rojo", "naranja", "amarillo", "azul", "libre"],
};

// Colores con cupo semanal de "comodines" por dieta (ver bloque `comodines`
// en server/src/data/diets/*.json). Solo se muestra la tarjeta explicativa
// para dietas que tienen ese bloque definido.
const COMODIN_COLORS: Partial<Record<DietId, string[]>> = {
  lowcarb: ["naranja", "amarillo"],
  maintenance: ["naranja", "amarillo"],
  "muscle-gain": ["naranja", "amarillo", "azul"],
};

const SEMAFORO_CARDS: { color: string; hex: string; title: string; description: string }[] = [
  {
    color: "rojo",
    hex: semaforo.rojo,
    title: "Rojo — evita",
    description: "Alimentos que van claramente en contra de tu tratamiento (azúcar añadida, frituras, ultraprocesados). No forman parte de tu menú.",
  },
  {
    color: "naranja",
    hex: semaforo.naranja,
    title: "Naranja — moderado",
    description: "Cereales, leguminosas, tubérculos y frutas: aportan energía pero se controlan por porción ('equivalente') para no pasarte de tu presupuesto diario.",
  },
  {
    color: "amarillo",
    hex: semaforo.amarillo,
    title: "Amarillo — moderado",
    description: "Oleaginosas, lácteos, quesos, aceites y grasas: también se cuentan por equivalente, igual que el naranja, pero son un grupo distinto.",
  },
  {
    color: "azul",
    hex: semaforo.azul,
    title: "Azul — proteína de alto valor",
    description: "Tus fuentes de proteína prioritarias. Se permiten con más libertad porque son la base de tu tratamiento.",
  },
  {
    color: "libre",
    hex: semaforo.libre,
    title: "Verde — libre",
    description: "Verduras y otros alimentos sin restricción de porción: puedes comerlos con la frecuencia que quieras.",
  },
];

export default function SemaforoInfoScreen() {
  const { user } = useAuth();
  const dietId = dietIdForGoal(user?.goal);
  const applicableColors = DIET_COLORS[dietId];
  const cards = SEMAFORO_CARDS.filter((card) => applicableColors.includes(card.color));
  const comodinColors = COMODIN_COLORS[dietId];

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>El semáforo de tu tratamiento</Text>
      <Text style={styles.subtitle}>
        Cada receta muestra chips de colores según el tipo de alimento que aporta. Así sabes de un vistazo qué tan
        alineada está con tu tratamiento.
      </Text>

      {cards.map((card) => (
        <View key={card.color} style={styles.card}>
          <View style={[styles.dot, { backgroundColor: card.hex }]} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </View>
        </View>
      ))}

      {comodinColors && (
        <View style={styles.comodinCard}>
          <View style={styles.comodinHeader}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.comodinTitle}>¿Qué son los "comodines"?</Text>
          </View>
          <Text style={styles.comodinText}>
            Cada semana tienes un cupo extra de excepciones por color ({comodinColors.join(", ")}) para los días en
            que te pases un poco de tu porción normal — así tu menú se ajusta sin salirte por completo del
            tratamiento.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.full,
    marginTop: 3,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
  comodinCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  comodinHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  comodinTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
  comodinText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    lineHeight: 18,
  },
});
