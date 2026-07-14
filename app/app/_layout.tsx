import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "@/context/AuthContext";
import { colors } from "@/theme";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

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
          <Stack.Screen
            name="semaforo-info"
            options={{ headerShown: true, headerTitle: "", headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
