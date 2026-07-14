import { useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as chatApi from "@/api/chat";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { NUTRIOLOGOS } from "@/data/nutriologos";
import { ChatMessage, ChatPremiumRequiredError, isPremiumUser } from "@/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/theme";

const INPUT_MIN_HEIGHT = 52;
const INPUT_MAX_HEIGHT = 140;

function nutriologosText() {
  return NUTRIOLOGOS.map((n) => `${n.name}: ${n.phone}`).join("\n");
}

export default function ChatScreen() {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ type?: string; name?: string; id?: string }>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

  const { data: history, isLoading } = useQuery({
    queryKey: ["chat", "history"],
    queryFn: chatApi.getChatHistory,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => chatApi.sendChatMessage(message),
    onMutate: async (message: string) => {
      const optimisticUserMessage: ChatMessage = {
        id: `local-${Date.now()}`,
        userId: "me",
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(["chat", "history"], (prev) => [...(prev ?? []), optimisticUserMessage]);
      return { optimisticId: optimisticUserMessage.id };
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: `local-${Date.now()}-assistant`,
        userId: "assistant",
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(["chat", "history"], (prev) => [...(prev ?? []), assistantMessage]);
    },
    onError: (err, _message, context) => {
      if (context?.optimisticId) {
        queryClient.setQueryData<ChatMessage[]>(["chat", "history"], (prev) =>
          (prev ?? []).filter((m) => m.id !== context.optimisticId)
        );
      }

      if (err instanceof ApiError && err.status === 403 && (err.data as ChatPremiumRequiredError | undefined)?.code === "PREMIUM_REQUIRED") {
        setLimitReached(true);
        Alert.alert("Función Premium", `${err.message}\n\n${nutriologosText()}`);
        return;
      }

      setError(err instanceof ApiError ? err.message : "No se pudo enviar tu mensaje.");
    },
  });

  useEffect(() => {
    if (history?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [history?.length, sendMutation.isPending]);

  useEffect(() => {
    if (!params.name) return;
    setDraft(`Tengo una pregunta sobre ${params.name}: `);
    inputRef.current?.focus();
  }, [params.type, params.name, params.id]);

  const handleSend = () => {
    const message = draft.trim();
    if (!message || sendMutation.isPending || limitReached) return;
    setError(null);
    setDraft("");
    setInputHeight(INPUT_MIN_HEIGHT);
    sendMutation.mutate(message);
  };

  if (!premium) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Tu copiloto</Text>
          <Text style={styles.subtitle}>Pregunta sobre tu menú, tu rutina de ejercicio o cualquier duda del camino.</Text>
        </View>
        <View style={styles.limitCard}>
          <Text style={styles.limitTitle}>El asistente es una función Premium</Text>
          <Text style={[styles.limitText, { marginTop: spacing.sm }]}>
            Con Premium tienes preguntas ilimitadas al asistente y tu asistente personal por WhatsApp.
          </Text>
          <Pressable onPress={() => router.push("/premium")}>
            <Text style={styles.upgradeLink}>Hazte Premium →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Tu copiloto</Text>
        <Text style={styles.subtitle}>Pregunta sobre tu menú, tu rutina de ejercicio o cualquier duda del camino.</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={history ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, item.role === "user" && styles.bubbleTextUser]}>{item.content}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Hola, soy tu copiloto en la app. Pregúntame qué cenar hoy, cómo sustituir un ingrediente, cómo ejecutar un
                ejercicio de tu rutina o cualquier duda sobre tu plan.
              </Text>
            </View>
          }
        />
      )}

      {sendMutation.isPending ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.typingText}>El asistente está escribiendo…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {limitReached ? (
        <View style={styles.limitCard}>
          <Text style={styles.limitTitle}>El asistente es una función Premium</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={12}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe tu pregunta…"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { height: inputHeight }]}
              multiline
              textAlignVertical="top"
              onContentSizeChange={(e) =>
                setInputHeight(
                  Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, e.nativeEvent.contentSize.height + 20))
                )
              }
              submitBehavior="submit"
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={sendMutation.isPending}>
              <Ionicons name="send" size={20} color={colors.textOnPrimary} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
});
