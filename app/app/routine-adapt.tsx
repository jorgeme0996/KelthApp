import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as routineAdaptApi from "@/api/routineAdapt";
import { useCurrentRoutine } from "@/hooks/useRoutine";
import { ApiError } from "@/api/client";
import { isPremiumRequiredError } from "@/utils/apiErrors";
import { useAuth } from "@/context/AuthContext";
import { DAY_LABELS, ExerciseOption, isPremiumUser, RoutineAdaptChatMessage, RoutineDayChange } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

const MAX_TURNS = 12;
const INPUT_MIN_HEIGHT = 52;
const INPUT_MAX_HEIGHT = 140;

type Step = "chat" | "review";

const EMPTY_STATE_TEXT = "Cuéntame qué no te gustó de tu rutina de esta semana y la ajusto. Por ejemplo: \"los martes tengo poco tiempo\" o \"no puedo acostarme para hacer ejercicios de piso\".";

function optionName(option: ExerciseOption): string {
  return option.kind === "catalog" ? option.exercise.name : option.draft.name;
}

export default function RoutineAdaptScreen() {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<RoutineAdaptChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ routineId: string }>();
  const { data: routine } = useCurrentRoutine();

  const [step, setStep] = useState<Step>("chat");
  const [messages, setMessages] = useState<RoutineAdaptChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [adaptation, setAdaptation] = useState<{ summary: string; dayChanges: RoutineDayChange[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

  const oldEntryById = useMemo(() => {
    const map = new Map<string, { name: string; sets: number; reps: number | null; durationSeconds: number | null }>();
    routine?.entries.forEach((entry) => {
      map.set(entry.id, { name: entry.exercise.name, sets: entry.sets, reps: entry.reps, durationSeconds: entry.durationSeconds });
    });
    return map;
  }, [routine]);

  const chatMutation = useMutation({
    mutationFn: (vars: { messages: RoutineAdaptChatMessage[] }) => routineAdaptApi.sendRoutineAdaptChat(params.routineId, vars.messages),
    onSuccess: (data) => {
      if (data.status === "message") {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        setAdaptation({ summary: data.summary, dayChanges: data.dayChanges });
        setStep("review");
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar tu mensaje.");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => routineAdaptApi.confirmRoutineAdapt(params.routineId, adaptation!.summary, adaptation!.dayChanges),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["routine", "current"] });
      if (data.skippedDays.length > 0) {
        const dayNames = data.skippedDays.map((d) => DAY_LABELS[d]).join(", ");
        Alert.alert(
          "Algunos días no se pudieron cambiar",
          `Ya habías completado tu entrenamiento de: ${dayNames}. Esos días no se modificaron.`,
          [{ text: "Entendido", onPress: () => router.back() }]
        );
        return;
      }
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
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo aplicar la adaptación.");
    },
  });

  const handleSend = () => {
    const text = draft.trim();
    if (!text || chatMutation.isPending || messages.length >= MAX_TURNS) return;

    const userMessage: RoutineAdaptChatMessage = { role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setInputHeight(INPUT_MIN_HEIGHT);
    setError(null);

    chatMutation.mutate({ messages: nextMessages });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const turnCapReached = messages.length >= MAX_TURNS;

  if (!premium) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Adaptar rutina con IA</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Esta función requiere una suscripción Premium.</Text>
          <Pressable onPress={() => router.replace("/premium")} style={{ marginTop: spacing.md }}>
            <Text style={styles.upgradeLink}>Ver planes Premium →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      {step === "chat" ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Adaptar rutina con IA</Text>
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
                <Text style={styles.emptyText}>{EMPTY_STATE_TEXT}</Text>
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
              <Text style={styles.limitText}>Si ya te propuso una adaptación, revísala; si no, vuelve a intentarlo más tarde.</Text>
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

      {step === "review" && adaptation ? (
        <View style={styles.optionsContainer}>
          <View style={styles.header}>
            <Pressable onPress={() => setStep("chat")} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Revisa los cambios</Text>
          </View>
          <FlatList
            data={adaptation.dayChanges}
            keyExtractor={(item) => `day-${item.dayIndex}`}
            contentContainerStyle={{ padding: spacing.lg }}
            ListHeaderComponent={<Text style={styles.summaryText}>{adaptation.summary}</Text>}
            renderItem={({ item }) => (
              <View style={styles.dayCard}>
                <Text style={styles.dayTitle}>{DAY_LABELS[item.dayIndex]}</Text>
                <Text style={styles.dayReason}>{item.reason}</Text>
                {item.entries.map((entry, index) => {
                  const oldEntry = oldEntryById.get(entry.entryId);
                  return (
                    <View key={`${entry.entryId}-${index}`} style={styles.diffRow}>
                      <Text style={styles.diffOld} numberOfLines={1}>
                        {oldEntry?.name ?? "Ejercicio actual"}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                      <Text style={styles.diffNew} numberOfLines={1}>
                        {optionName(entry.option)}
                      </Text>
                    </View>
                  );
                })}
                {item.removeEntryIds.map((entryId) => {
                  const oldEntry = oldEntryById.get(entryId);
                  return (
                    <View key={`remove-${entryId}`} style={styles.diffRow}>
                      <Text style={styles.diffOld} numberOfLines={1}>
                        {oldEntry?.name ?? "Ejercicio actual"}
                      </Text>
                      <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                      <Text style={[styles.diffNew, styles.diffRemoved]} numberOfLines={1}>
                        Se elimina
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            ListFooterComponent={
              <Pressable style={styles.chooseButton} onPress={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.chooseButtonText}>Aplicar cambios</Text>
                )}
              </Pressable>
            }
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
  summaryText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  dayReason: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  diffOld: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textDecorationLine: "line-through",
    textTransform: "capitalize",
  },
  diffNew: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text,
    textTransform: "capitalize",
  },
  diffRemoved: {
    color: colors.danger,
  },
  chooseButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  chooseButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textOnPrimary,
  },
});
