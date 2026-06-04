import type { ChatMessage } from "./types.js";

type RawHistoryMessage = {
  role?: string;
  content?: unknown;
  msg?: unknown;
  message?: unknown;
};

export type HistoryApiResponse = {
  messages?: RawHistoryMessage[];
};

function pickContent(msg: RawHistoryMessage): string {
  const c = msg.content ?? msg.msg ?? msg.message;
  if (c == null) return "";
  if (typeof c === "string") return c;
  try {
    return String(c);
  } catch {
    return "";
  }
}

function normalizeRole(r: string | undefined): "user" | "assistant" | null {
  if (r === "user" || r === "assistant") return r;
  return null;
}

/** Normalizes GET /chat/history response into canonical ChatMessage[]. */
export function normalizeHistoryMessages(data: unknown): ChatMessage[] {
  const body = data as HistoryApiResponse;
  const list = body?.messages;
  if (!Array.isArray(list)) return [];

  const out: ChatMessage[] = [];
  for (const m of list) {
    const role = normalizeRole(typeof m?.role === "string" ? m.role : undefined);
    if (!role) continue;
    const content = pickContent(m);
    out.push({ role, content });
  }
  return out;
}

export function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "user");
}
