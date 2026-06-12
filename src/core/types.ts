export type ChatRole = "user" | "assistant";

/** RAG / web search / doc footnotes — rendered when using AI Elements slots or builtins. */
export type ChatSource = {
  title: string;
  url?: string;
};

/** Tool/agent step for UI — populate via `parseChunk` + SSE or hydrate from history API. */
export type ChatToolInvocation = {
  id?: string;
  name: string;
  state: "pending" | "complete" | "error";
  args?: unknown;
  result?: string;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  sources?: ChatSource[];
  toolInvocations?: ChatToolInvocation[];
};

export type ChatAnalyticsEvent =
  | { type: "fab_open" }
  | { type: "panel_close" }
  | { type: "message_send"; fromQuickQuestion: boolean }
  | { type: "quick_question_click"; question: string };

export type StreamEventPayload = Record<string, unknown>;

export type ParseChunkResult =
  | { kind: "assistant_delta"; text: string }
  | { kind: "assistant_complete" }
  /** Replace assistant `sources` on the in-flight bubble (last assistant message). */
  | { kind: "assistant_sources"; sources: ChatSource[] }
  /** Append or upsert (by `id` when set) a tool row on the in-flight assistant bubble. */
  | { kind: "assistant_tool"; tool: ChatToolInvocation }
  | { kind: "ignore" };

export type ChatAnalyticsContext = {
  sessionId: string;
  sessionIdSuffix: string;
  teamName: string;
};
