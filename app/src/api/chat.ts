import { api } from "./client";
import { ChatMessage } from "@/types";

export function getChatHistory() {
  return api.get<ChatMessage[]>("/api/chat/history");
}

export function sendChatMessage(message: string) {
  return api.post<{ reply: string }>("/api/chat", { message });
}
