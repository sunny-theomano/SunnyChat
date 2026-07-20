import { mergeChatAuthHeaders } from "./authHeaders.js";
import { chatPathFor, type ChatSurface } from "./chatSurface.js";
import { defaultParseChunk, extractJsonBlocks } from "./parseSse.js";
import type { ParseChunkResult, StreamEventPayload } from "./types.js";

export type { ChatSurface } from "./chatSurface.js";
export { CHAT_SURFACES, chatPathFor } from "./chatSurface.js";

export type StreamChatBody = {
  message: string;
  user_id: string;
  stream: boolean;
  monitor: boolean;
  session_id: string;
  team_name: string;
};

export type StreamChatParams = {
  url: string;
  body: StreamChatBody;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Frontend API key — sent as `Authorization: Bearer …` when set. */
  apiKey?: string;
  parseChunk?: (json: StreamEventPayload) => ParseChunkResult;
  onDelta: (text: string) => void;
  /** Called for every parsed SSE object (deltas, sources, tools, ignore). */
  onParseChunk?: (result: ParseChunkResult) => void;
  onComplete?: () => void;
};

export async function streamChatResponse(params: StreamChatParams): Promise<void> {
  const fetchFn = params.fetchImpl ?? fetch;
  const parseChunk = params.parseChunk ?? defaultParseChunk;

  const res = await fetchFn(params.url, {
    method: "POST",
    headers: mergeChatAuthHeaders(params.apiKey, {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params.body),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const err = new Error(`Chat HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const { blocks, rest } = extractJsonBlocks(carry);
      carry = rest;
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const json = block as StreamEventPayload;
        const r = parseChunk(json);
        params.onParseChunk?.(r);
        if (r.kind === "assistant_delta") params.onDelta(r.text);
      }
    }
    // Flush trailing buffered line(s) once the stream ends
    if (carry.trim()) {
      const { blocks } = extractJsonBlocks(`${carry}\n\n`);
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const json = block as StreamEventPayload;
        const r = parseChunk(json);
        params.onParseChunk?.(r);
        if (r.kind === "assistant_delta") params.onDelta(r.text);
      }
    }
  } finally {
    params.onComplete?.();
  }
}

/**
 * Chat POST URL for a surface:
 * - `default` → `POST …/agents/chat`
 * - `preProposal` → `POST …/agents/pre-proposal/chat`
 * - `postProposal` → `POST …/agents/post-proposal/chat`
 */
export function resolveChatUrl(
  baseUrl: string,
  surface: ChatSurface = "default",
): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${chatPathFor(surface)}`;
}

/** `GET ${normalize(baseUrl)}/agents/chat/history/:userId` */
export function resolveHistoryUrl(baseUrl: string, userId: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/agents/chat/history/${encodeURIComponent(userId)}`;
}
