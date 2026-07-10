import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { AuthProvider } from "@/context/AuthContext";
import { colors } from "@/theme";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    // Al tocar una notificación de recordatorio, navega directo a la pantalla
    // que mandó el servidor (data.url) usando el mismo deep link scheme que
    // ya maneja expo-router.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) Linking.openURL(url).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="recipe/[id]"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
          <Stack.Screen
            name="exercise/[id]"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
          <Stack.Screen
            name="meal-swap"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
          <Stack.Screen
            name="exercise-swap"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
          <Stack.Screen
            name="routine-adapt"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
          <Stack.Screen name="billing/success" options={{ headerShown: false }} />
          <Stack.Screen name="billing/cancel" options={{ headerShown: false }} />
          <Stack.Screen name="billing/return" options={{ headerShown: false }} />
          <Stack.Screen
            name="premium"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
