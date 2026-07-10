import { useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as exerciseSwapApi from "@/api/exerciseSwap";
import * as usageApi from "@/api/usage";
import { ApiError } from "@/api/client";
import { isWeeklyLimitError } from "@/utils/apiErrors";
import { WeeklyLimitModal } from "@/components/WeeklyLimitModal";
import { useAuth } from "@/context/AuthContext";
import { ExerciseOption, ExerciseSwapChatMessage, ExerciseSwapMode, isPremiumUser } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

const MAX_TURNS = 12;
const INPUT_MIN_HEIGHT = 52;
const INPUT_MAX_HEIGHT = 140;

type Step = "mode-select" | "chat" | "options";

const MODE_CARDS: { mode: ExerciseSwapMode; icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  {
    mode: "equipment_unavailable",
    icon: "barbell-outline",
    title: "El aparato no está en mi gym",
    description: "Dime qué máquinas o equipo sí tienes disponibles y te sugiero alternativas.",
  },
  {
    mode: "technique_help",
    icon: "help-circle-outline",
    title: "No entendí cómo hacer el ejercicio",
    description: "Cuéntame qué se te dificultó y te explico la técnica o te sugiero un cambio.",
  },
];

const EMPTY_STATE_TEXT: Record<ExerciseSwapMode, string> = {
  equipment_unavailable: "Cuéntame qué máquinas o equipo ves disponibles para este grupo muscular en tu gym.",
  technique_help: "Cuéntame qué se te dificultó del ejercicio, o si sentiste alguna molestia al hacerlo.",
};

function optionName(option: ExerciseOption): string {
  return option.kind === "catalog" ? option.exercise.name : option.draft.name;
}

function optionImageUrl(option: ExerciseOption): string | null {
  return option.kind === "catalog" ? option.exercise.imageUrl : null;
}

function optionEquipment(option: ExerciseOption): string {
  return option.kind === "catalog" ? option.exercise.equipment : option.draft.equipment;
}

export default function ExerciseSwapScreen() {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ExerciseSwapChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ entryId: string; bodyPart: string; exerciseName: string }>();

  // Peeked ahead of time so picking a mode doesn't need to wait on a network
  // round trip to know whether this user still has a swap available.
  const weeklyUsageQuery = useQuery({
    queryKey: ["usage", "weekly-status"],
    queryFn: usageApi.getWeeklyUsageStatus,
    enabled: !premium,
    staleTime: 0,
  });

  const [step, setStep] = useState<Step>("mode-select");
  const [mode, setMode] = useState<ExerciseSwapMode | null>(null);
  const [messages, setMessages] = useState<ExerciseSwapChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<ExerciseOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weeklyLimitVisible, setWeeklyLimitVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

  const chatMutation = useMutation({
    mutationFn: (vars: { messages: ExerciseSwapChatMessage[] }) =>
      exerciseSwapApi.sendExerciseSwapChat(params.entryId, mode as ExerciseSwapMode, vars.messages),
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
    mutationFn: (option: ExerciseOption) => exerciseSwapApi.confirmExerciseSwap(params.entryId, option),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routine", "current"] });
      router.back();
    },
    onError: (err) => {
      if (isWeeklyLimitError(err)) {
        setWeeklyLimitVisible(true);
        return;
      }
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo aplicar el cambio.");
    },
  });

  const handleSelectMode = (selected: ExerciseSwapMode) => {
    if (!premium && weeklyUsageQuery.data?.allowed === false) {
      setWeeklyLimitVisible(true);
      return;
    }
    setMode(selected);
    setStep("chat");
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!mode || !text || chatMutation.isPending || messages.length >= MAX_TURNS) return;

    const userMessage: ExerciseSwapChatMessage = { role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setInputHeight(INPUT_MIN_HEIGHT);
    setError(null);

    chatMutation.mutate({ messages: nextMessages });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleRestart = () => {
    setStep("mode-select");
    setMode(null);
    setMessages([]);
    setDraft("");
    setOptions(null);
    setError(null);
  };

  const turnCapReached = messages.length >= MAX_TURNS;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      {step === "mode-select" ? (
        <View style={styles.modeContainer}>
          <Text style={styles.title}>Cambiar con IA</Text>
          <Text style={styles.subtitle}>Vamos a ayudarte con "{params.exerciseName}". Elige cómo quieres que te ayude:</Text>
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
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Escribe tu mensaje…"
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
            keyExtractor={(item, index) => `${optionName(item)}-${index}`}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item, index }) => {
              const imageUrl = optionImageUrl(item);
              return (
                <View style={styles.optionCard}>
                  <View style={styles.optionRow}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.optionThumbnail} contentFit="cover" />
                    ) : (
                      <View style={[styles.optionThumbnail, styles.optionThumbnailPlaceholder]}>
                        <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionName}>{optionName(item)}</Text>
                      <Text style={styles.optionEquipment}>{optionEquipment(item)}</Text>
                    </View>
                  </View>
                  {item.kind === "ai_generated" ? (
                    <>
                      <View style={styles.aiBadge}>
                        <Ionicons name="sparkles" size={12} color={colors.primaryDark} />
                        <Text style={styles.aiBadgeText}>Generado con IA</Text>
                      </View>
                      <View style={styles.mediaPlaceholder}>
                        <Ionicons name="videocam-outline" size={18} color={colors.textMuted} />
                        <Text style={styles.mediaPlaceholderText}>Trabajando en la imagen/video</Text>
                      </View>
                    </>
                  ) : null}
                  <Pressable
                    style={styles.chooseButton}
                    onPress={() => confirmMutation.mutate(item)}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending && confirmMutation.variables === item ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.chooseButtonText}>Elegir esta opción</Text>
                    )}
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      ) : null}

      <WeeklyLimitModal visible={weeklyLimitVisible} onClose={() => setWeeklyLimitVisible(false)} />
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
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  optionThumbnail: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  optionThumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    textTransform: "capitalize",
  },
  optionEquipment: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  aiBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  mediaPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  mediaPlaceholderText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
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
