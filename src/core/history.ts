import type { ChatMessage, ChatSource, ChatToolInvocation } from "./types.js";

type RawHistoryMessage = {
  role?: string;
  content?: unknown;
  msg?: unknown;
  message?: unknown;
  sources?: unknown;
  toolInvocations?: unknown;
  tools?: unknown;
};

export type HistoryApiResponse = {
  messages?: RawHistoryMessage[];
};

function pickSources(msg: RawHistoryMessage): ChatSource[] | undefined {
  const raw = msg.sources;
  if (!Array.isArray(raw)) return undefined;
  const out: ChatSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { title?: unknown; url?: unknown };
    const url = typeof o.url === "string" ? o.url : undefined;
    const title =
      typeof o.title === "string" && o.title.trim()
        ? o.title.trim()
        : url ?? "";
    if (!title) continue;
    out.push({ title, url });
  }
  return out.length > 0 ? out : undefined;
}

function pickToolInvocations(msg: RawHistoryMessage): ChatToolInvocation[] | undefined {
  const raw = msg.toolInvocations ?? msg.tools;
  if (!Array.isArray(raw)) return undefined;
  const out: ChatToolInvocation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      id?: unknown;
      name?: unknown;
      state?: unknown;
      args?: unknown;
      result?: unknown;
    };
    const name = typeof o.name === "string" ? o.name : "tool";
    const stateRaw = typeof o.state === "string" ? o.state : "complete";
    const state =
      stateRaw === "pending" || stateRaw === "complete" || stateRaw === "error"
        ? stateRaw
        : "complete";
    out.push({
      id: typeof o.id === "string" ? o.id : undefined,
      name,
      state,
      args: o.args,
      result: typeof o.result === "string" ? o.result : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

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
    const sources = pickSources(m);
    const toolInvocations = pickToolInvocations(m);
    out.push({
      role,
      content,
      ...(sources ? { sources } : {}),
      ...(toolInvocations ? { toolInvocations } : {}),
    });
  }
  return out;
}

export function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "user");
}
