const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high" }),
  });

  const result = (await response.json()) as { data?: ExpoPushTicket; errors?: unknown };
  const ticket = result.data;
  if (!response.ok || !ticket || ticket.status === "error") {
    throw new Error(`Expo push send failed: ${JSON.stringify(result)}`);
  }
}
