import { api } from "./client";

export function registerPushToken(token: string) {
  return api.post<{ ok: true }>("/api/push/register", { token });
}

export function unregisterPushToken() {
  return api.post<{ ok: true }>("/api/push/unregister");
}
