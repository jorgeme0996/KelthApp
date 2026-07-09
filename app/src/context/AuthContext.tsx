import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOKEN_KEY } from "@/api/client";
import * as authApi from "@/api/auth";
import { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: import("@/api/auth").RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (
    data: Partial<
      Pick<
        User,
        | "mealsPerDay"
        | "exerciseDaysPerWeek"
        | "name"
        | "age"
        | "heightCm"
        | "weightKg"
        | "goal"
        | "gender"
        | "splitType"
        | "equipmentPreference"
        | "dietaryRestrictions"
        | "trainingDays"
        | "phone"
      >
    >
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const me = await authApi.getMe();
          setUser(me);
        } catch {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: authApi.RegisterPayload) => {
    const res = await authApi.register(payload);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    async (
      data: Partial<
        Pick<
          User,
          | "mealsPerDay"
          | "exerciseDaysPerWeek"
          | "name"
          | "age"
          | "heightCm"
          | "weightKg"
          | "goal"
          | "gender"
          | "splitType"
          | "equipmentPreference"
          | "dietaryRestrictions"
          | "trainingDays"
          | "phone"
        >
      >,
    ) => {
      const updated = await authApi.updateMe(data);
      setUser(updated);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const me = await authApi.getMe();
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
