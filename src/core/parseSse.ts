import type { ParseChunkResult, StreamEventPayload } from "./types.js";

/**
 * Default Sunny backend: RunContent / RunCompleted.
 *
 * Extend in your app for tools / citations, e.g. return `{ kind: "assistant_tool", tool: { name: "search", state: "pending" } }`
 * or `{ kind: "assistant_sources", sources: [{ title: "Docs", url: "https://..." }] }` from your SSE `event` payloads.
 */
export function defaultParseChunk(json: StreamEventPayload): ParseChunkResult {
  const event = typeof json.event === "string" ? json.event : "";
  if (event === "RunContent") {
    const content = json.content;
    if (typeof content === "string" && content.length > 0) {
      return { kind: "assistant_delta", text: content };
    }
    return { kind: "ignore" };
  }
  if (event === "RunCompleted") {
    return { kind: "assistant_complete" };
  }
  return { kind: "ignore" };
}

/**
 * Reads SSE-style stream: split decoded chunks on `\n\n`, JSON.parse each block.
 * Invokes onEvent for each parsed object; swallow parse errors (buffer partials externally).
 */
export function extractJsonBlocks(buffer: string): { blocks: unknown[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const blocks: unknown[] = [];
  for (const raw of parts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      blocks.push(JSON.parse(trimmed) as unknown);
    } catch {
      // partial / garbage — doc: ignore until complete
    }
  }
  return { blocks, rest };
}
