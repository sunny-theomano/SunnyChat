import { defaultParseChunk, extractJsonBlocks } from "./parseSse.js";
import type { ParseChunkResult, StreamEventPayload } from "./types.js";

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
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
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
    // flush trailing single block without trailing \n\n
    const tail = carry.trim();
    if (tail) {
      try {
        const json = JSON.parse(tail) as StreamEventPayload;
        const r = parseChunk(json);
        params.onParseChunk?.(r);
        if (r.kind === "assistant_delta") params.onDelta(r.text);
      } catch {
        // incomplete tail — ignore
      }
    }
  } finally {
    params.onComplete?.();
  }
}

/** `POST ${normalize(baseUrl)}/chat` */
export function resolveChatUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/chat`;
}

/** `GET ${normalize(baseUrl)}/chat/history/:userId` */
export function resolveHistoryUrl(baseUrl: string, userId: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/chat/history/${encodeURIComponent(userId)}`;
}
