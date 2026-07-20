import type { ParseChunkResult, StreamEventPayload } from "./types.js";

/**
 * Default Sunny backend: RunContent / RunCompleted.
 *
 * Extend in your app for tools / citations, e.g. return `{ kind: "assistant_tool", tool: { name: "search", state: "pending" } }`
 * or `{ kind: "assistant_sources", sources: [{ title: "Docs", url: "https://..." }] }` from your SSE `event` payloads.
 */
export function defaultParseChunk(json: StreamEventPayload): ParseChunkResult {
  const event =
    typeof json.event === "string"
      ? json.event
      : typeof json.type === "string"
        ? json.type
        : "";
  if (event === "RunContent" || event === "TeamRunContent") {
    const content = json.content;
    if (typeof content === "string" && content.length > 0) {
      return { kind: "assistant_delta", text: content };
    }
    return { kind: "ignore" };
  }
  if (event === "RunCompleted" || event === "TeamRunCompleted") {
    return { kind: "assistant_complete" };
  }
  return { kind: "ignore" };
}

/**
 * Parses an SSE stream buffer.
 *
 * Supports:
 * - Standard SSE: `event: RunContent\ndata: {"event":"RunContent","content":"…"}\n\n`
 * - Legacy raw JSON blocks: `{"event":"RunContent","content":"…"}\n\n`
 *
 * Incomplete trailing lines stay in `rest` until the next read.
 */
export function extractJsonBlocks(buffer: string): {
  blocks: unknown[];
  rest: string;
} {
  const blocks: unknown[] = [];
  const lines = buffer.split(/\r?\n/);
  const restLine = lines.pop() ?? "";

  let pendingEventName = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingEventName = "";
      continue;
    }

    if (trimmed.startsWith("event:")) {
      pendingEventName = trimmed.slice(6).trim();
      continue;
    }

    let jsonStr = "";
    if (trimmed.startsWith("data:")) {
      jsonStr = trimmed.slice(5).trim();
    } else if (trimmed.startsWith("{")) {
      // Legacy: raw JSON block without `data:` prefix
      jsonStr = trimmed;
    } else {
      continue;
    }

    if (!jsonStr || jsonStr === "[DONE]") continue;

    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      if (pendingEventName && typeof parsed.event !== "string") {
        parsed.event = pendingEventName;
      }
      blocks.push(parsed);
    } catch {
      // Malformed / incomplete JSON line — skip
    }
  }

  const rest =
    pendingEventName && restLine
      ? `event: ${pendingEventName}\n${restLine}`
      : restLine;

  return { blocks, rest };
}
