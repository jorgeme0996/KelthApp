import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as mealSwapApi from "@/api/mealSwap";
import { ApiError } from "@/api/client";
import { isPremiumRequiredError } from "@/utils/apiErrors";
import { useAuth } from "@/context/AuthContext";
import { isPremiumUser, MealSwapChatMessage, MealSwapImage, MealSwapMode, RecipeDraft } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

const MAX_TURNS = 12;
const INPUT_MIN_HEIGHT = 52;
const INPUT_MAX_HEIGHT = 140;

type Step = "mode-select" | "chat" | "options";

const MODE_CARDS: { mode: MealSwapMode; icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  {
    mode: "fridge",
    icon: "nutrition-outline",
    title: "¿Qué tienes en el refri?",
    description: "Dime qué ingredientes tienes en casa y te ayudo a decidir qué preparar.",
  },
  {
    mode: "restaurant_options",
    icon: "restaurant-outline",
    title: "Voy a pedir comida",
    description: "Dame las opciones de restaurantes que estás pensando y te asesoro.",
  },
  {
    mode: "menu_photo",
    icon: "camera-outline",
    title: "Ya estoy en el restaurante",
    description: "Envía una foto del menú y te ayudo a decidir qué pedir ahí.",
  },
];

const EMPTY_STATE_TEXT: Record<MealSwapMode, string> = {
  fridge: "Cuéntame qué ingredientes tienes disponibles (proteína, verduras, grasas...) y te propongo qué preparar.",
  restaurant_options: "Dime qué restaurantes o platillos estás considerando y te digo cuál te conviene más.",
  menu_photo: "Toma o sube una foto del menú del restaurante y te ayudo a elegir qué pedir.",
};

export default function MealSwapScreen() {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MealSwapChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ entryId: string; mealSlot: string; recipeName: string }>();

  const [step, setStep] = useState<Step>("mode-select");
  const [mode, setMode] = useState<MealSwapMode | null>(null);
  const [messages, setMessages] = useState<MealSwapChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<(MealSwapImage & { previewUri: string }) | null>(null);
  const [options, setOptions] = useState<RecipeDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

  const chatMutation = useMutation({
    mutationFn: (vars: { messages: MealSwapChatMessage[]; image?: MealSwapImage }) =>
      mealSwapApi.sendMealSwapChat(params.entryId, mode as MealSwapMode, vars.messages, vars.image),
    onSuccess: (data) => {
      if (data.status === "message") {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        setOptions(data.options);
        setStep("options");
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar tu mensaje.");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (recipe: RecipeDraft) => mealSwapApi.confirmMealSwap(params.entryId, recipe),
    onSuccess: async () => {
      // isPending stays true while onSuccess is awaited, keeping the option disabled
      // until the meal plan actually reflects the swap
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mealplan", "current"] }),
        queryClient.invalidateQueries({ queryKey: ["shoppingList"] }),
      ]);
      router.back();
    },
    onError: (err) => {
      if (isPremiumRequiredError(err)) {
        Alert.alert("Función Premium", "Esta función requiere una suscripción Premium.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver planes", onPress: () => router.push("/premium") },
        ]);
        return;
      }
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo aplicar el cambio.");
    },
  });

  const handleSelectMode = (selected: MealSwapMode) => {
    setMode(selected);
    setStep("chat");
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!mode || (!text && !pendingImage) || chatMutation.isPending || messages.length >= MAX_TURNS) return;

    const userMessage: MealSwapChatMessage = {
      role: "user",
      text: text || "Aquí está la foto del menú del restaurante.",
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setInputHeight(INPUT_MIN_HEIGHT);
    setError(null);

    const image = pendingImage ? { mediaType: pendingImage.mediaType, dataBase64: pendingImage.dataBase64 } : undefined;
    setPendingImage(null); // sent at most once — the server never needs it again on later turns

    chatMutation.mutate({ messages: nextMessages, image });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const pickImage = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permiso necesario", "Necesitamos acceso para poder leer la foto del menú.");
      return;
    }

    const launch = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({ mediaTypes: ["images"], base64: true, quality: 0.5 });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) return;

    const mimeType = asset.mimeType ?? "";
    const mediaType: MealSwapImage["mediaType"] = mimeType.includes("png")
      ? "image/png"
      : mimeType.includes("webp")
        ? "image/webp"
        : "image/jpeg";

    setPendingImage({ mediaType, dataBase64: asset.base64, previewUri: asset.uri });
  };

  const handleRestart = () => {
    setStep("mode-select");
    setMode(null);
    setMessages([]);
    setDraft("");
    setPendingImage(null);
    setOptions(null);
    setError(null);
  };

  const turnCapReached = messages.length >= MAX_TURNS;

  if (!premium) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <View style={styles.modeContainer}>
          <Text style={styles.title}>Cambiar con IA</Text>
          <Text style={styles.subtitle}>Esta función requiere una suscripción Premium.</Text>
          <Pressable onPress={() => router.replace("/premium")}>
            <Text style={styles.upgradeLink}>Ver planes Premium →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      {step === "mode-select" ? (
        <View style={styles.modeContainer}>
          <Text style={styles.title}>Cambiar con IA</Text>
          <Text style={styles.subtitle}>
            Vamos a reemplazar "{params.recipeName}". Elige cómo quieres que te ayude:
          </Text>
          {MODE_CARDS.map((card) => (
            <Pressable key={card.mode} style={styles.modeCard} onPress={() => handleSelectMode(card.mode)}>
              <View style={styles.modeIconWrap}>
                <Ionicons name={card.icon} size={24} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeCardTitle}>{card.title}</Text>
                <Text style={styles.modeCardDescription}>{card.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === "chat" && mode ? (
        <>
          <View style={styles.header}>
            <Pressable onPress={handleRestart} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{MODE_CARDS.find((c) => c.mode === mode)?.title}</Text>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, index) => `msg-${index}`}
            contentContainerStyle={styles.messages}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.bubbleText, item.role === "user" && styles.bubbleTextUser]}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>{EMPTY_STATE_TEXT[mode]}</Text>
              </View>
            }
          />

          {chatMutation.isPending ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>El asistente está escribiendo…</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {turnCapReached ? (
            <View style={styles.limitCard}>
              <Text style={styles.limitTitle}>Llegaste al máximo de mensajes de esta conversación</Text>
              <Text style={styles.limitText}>Elige una de las opciones si ya te propuso alguna, o reinicia para empezar de nuevo.</Text>
              <Pressable onPress={handleRestart}>
                <Text style={styles.upgradeLink}>Reiniciar conversación →</Text>
              </Pressable>
            </View>
          ) : (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={12}>
              {mode === "menu_photo" ? (
                <View style={styles.photoRow}>
                  {pendingImage ? (
                    <View style={styles.photoPreviewWrap}>
                      <Image source={{ uri: pendingImage.previewUri }} style={styles.photoPreview} />
                      <Pressable style={styles.photoRemove} onPress={() => setPendingImage(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Pressable style={styles.photoButton} onPress={() => pickImage("camera")}>
                        <Ionicons name="camera" size={18} color={colors.primaryDark} />
                        <Text style={styles.photoButtonText}>Tomar foto</Text>
                      </Pressable>
                      <Pressable style={styles.photoButton} onPress={() => pickImage("library")}>
                        <Ionicons name="image" size={18} color={colors.primaryDark} />
                        <Text style={styles.photoButtonText}>Elegir de galería</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={mode === "menu_photo" ? "Agrega un comentario (opcional)…" : "Escribe tu mensaje…"}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { height: inputHeight }]}
                  multiline
                  textAlignVertical="top"
                  onContentSizeChange={(e) =>
                    setInputHeight(Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, e.nativeEvent.contentSize.height + 20)))
                  }
                  submitBehavior="submit"
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <Pressable style={styles.sendButton} onPress={handleSend} disabled={chatMutation.isPending}>
                  <Ionicons name="send" size={20} color={colors.textOnPrimary} />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </>
      ) : null}

      {step === "options" && options ? (
        <View style={styles.optionsContainer}>
          <View style={styles.header}>
            <Pressable onPress={() => setStep("chat")} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Elige una opción</Text>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <View style={styles.optionCard}>
                <Text style={styles.optionName}>{item.name}</Text>
                <View style={styles.equivalentsRow}>
                  {item.prepTimeMinutes ? (
                    <View style={styles.equivalentChip}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.equivalentChipText}> {item.prepTimeMinutes} min</Text>
                    </View>
                  ) : null}
                  {Object.entries(item.equivalents).map(([key, value]) => (
                    <View key={key} style={styles.equivalentChip}>
                      <Text style={styles.equivalentChipText}>
                        {value} {key}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.optionIngredients}>{item.ingredients.map((i) => i.name).join(", ")}</Text>
                <Pressable
                  style={styles.chooseButton}
                  onPress={() => confirmMutation.mutate(item)}
                  disabled={confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.chooseButtonText}>Elegir esta opción</Text>
                  )}
                </Pressable>
              </View>
            )}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modeContainer: {
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modeCardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  modeCardDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  messages: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: colors.textOnPrimary,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  typingText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  limitCard: {
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  limitTitle: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  limitText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  upgradeLink: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  photoRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  photoButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  photoPreviewWrap: {
    position: "relative",
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsContainer: {
    flex: 1,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  equivalentsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  equivalentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  equivalentChipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  optionIngredients: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  chooseButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chooseButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textOnPrimary,
  },
});
