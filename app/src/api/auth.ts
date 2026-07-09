import { api } from "./client";
import { User } from "@/types";

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  mealsPerDay: number;
  exerciseDaysPerWeek?: number;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal?: string;
  gender?: string;
  splitType?: string;
  equipmentPreference?: string;
  dietaryRestrictions?: string[];
  trainingDays?: number[];
  phone?: string;
}

export function register(payload: RegisterPayload) {
  return api.post<AuthResponse>("/api/auth/register", payload);
}

export function login(email: string, password: string) {
  return api.post<AuthResponse>("/api/auth/login", { email, password });
}

export function getMe() {
  return api.get<User>("/api/auth/me");
}

export function updateMe(
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
) {
  return api.patch<User>("/api/auth/me", data);
}

export function forgotPassword(email: string) {
  return api.post<{ message: string }>("/api/auth/forgot-password", { email });
}

export function resetPassword(token: string, password: string) {
  return api.post<{ message: string }>("/api/auth/reset-password", { token, password });
}
