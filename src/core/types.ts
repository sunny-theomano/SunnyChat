export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
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
  | { kind: "ignore" };

export type ChatAnalyticsContext = {
  sessionId: string;
  sessionIdSuffix: string;
  teamName: string;
};
