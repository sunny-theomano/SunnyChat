import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { hasUserMessage, normalizeHistoryMessages } from "../core/history.js";
import { buildSessionId, generateAnonymousId } from "../core/session.js";
import {
  resolveChatUrl,
  resolveHistoryUrl,
  streamChatResponse,
} from "../core/streamChat.js";
import type {
  ChatAnalyticsContext,
  ChatAnalyticsEvent,
  ChatMessage,
  ChatToolInvocation,
  ParseChunkResult,
  StreamEventPayload,
} from "../core/types.js";

const DEFAULT_ERROR =
  "I'm having trouble connecting. Please try again in a moment.";
const DEFAULT_MONITOR = true;

function patchLastAssistant(
  prev: ChatMessage[],
  fn: (m: ChatMessage) => ChatMessage,
): ChatMessage[] {
  if (prev.length === 0) return prev;
  const next = [...prev];
  const last = next[next.length - 1];
  if (!last || last.role !== "assistant") return prev;
  next[next.length - 1] = fn(last);
  return next;
}

function mergeToolInvocations(
  existing: ChatToolInvocation[] | undefined,
  tool: ChatToolInvocation,
): ChatToolInvocation[] {
  const list = [...(existing ?? [])];
  const id = tool.id;
  if (id) {
    const idx = list.findIndex((t) => t.id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...tool };
    else list.push(tool);
  } else {
    list.push(tool);
  }
  return list;
}

function applyParseChunkToMessages(
  prev: ChatMessage[],
  r: ParseChunkResult,
): ChatMessage[] {
  if (r.kind === "assistant_sources") {
    return patchLastAssistant(prev, (m) => ({
      ...m,
      sources: r.sources,
    }));
  }
  if (r.kind === "assistant_tool") {
    return patchLastAssistant(prev, (m) => ({
      ...m,
      toolInvocations: mergeToolInvocations(m.toolInvocations, r.tool),
    }));
  }
  return prev;
}

export type UseChatSessionConfig = {
  /** If true, panel starts open (headless / embedded modes). */
  initialOpen?: boolean;
  /**
   * API origin only (no `/chat` suffix). The package calls:
   * - `POST ${baseUrl}/chat` for streaming messages
   * - `GET ${baseUrl}/chat/history/:userId` for history
   */
  baseUrl: string;
  teamName: string;
  sessionIdSuffix: string;
  getUserId: () => string | null;
  greetingAssistantText: string;
  quickQuestions?: string[];
  /**
   * When `quickQuestions` are shown above the composer.
   * - `welcome` (default): only before the first user send (original behavior).
   * - `always`: whenever the panel is open and `quickQuestions` is non-empty (AI Elements–style persistent chips).
   */
  quickReplyBehavior?: "welcome" | "always";
  sanitizeHistory?: (data: unknown) => unknown;
  filterUiMessages?: (messages: ChatMessage[]) => ChatMessage[];
  shouldSkipAutoSend?: (messages: ChatMessage[]) => boolean;
  onAnalytics?: (
    event: ChatAnalyticsEvent,
    context: ChatAnalyticsContext
  ) => void;
  fetchImpl?: typeof fetch;
  parseChunk?: (json: StreamEventPayload) => ParseChunkResult;
  /** Shown on the in-flight assistant bubble when POST fails or stream errors. */
  connectionErrorText?: string;
  /** Override anonymous id (e.g. tests). */
  generateAnonymousId?: () => string;
};

export type SendMessageOptions = {
  fromQuickQuestion?: boolean;
  /** Send text to API but do not append a user bubble in UI. */
  hideUserMessage?: boolean;
};

export function useChatSession(cfg: UseChatSessionConfig) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInputState] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyInitialized, setHistoryInitialized] = useState(false);
  const [isOpen, setIsOpen] = useState(cfg.initialOpen ?? false);
  const [hasCommittedInteraction, setHasCommittedInteraction] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const anonymousIdRef = useRef<string | null>(null);
  const historyRequestedRef = useRef(false);
  /** True when the composer has non-empty text (user started typing before history landed). */
  const pendingLocalActivityRef = useRef(false);

  const errorText = cfg.connectionErrorText ?? DEFAULT_ERROR;

  const authUserId = cfg.getUserId()?.trim() || null;
  if (!authUserId && !anonymousIdRef.current) {
    anonymousIdRef.current = cfg.generateAnonymousId
      ? cfg.generateAnonymousId()
      : generateAnonymousId();
  }
  const effectiveUserId = authUserId ?? anonymousIdRef.current!;

  const sessionId = useMemo(
    () =>
      buildSessionId({
        userId: authUserId,
        anonymousId: anonymousIdRef.current!,
        sessionIdSuffix: cfg.sessionIdSuffix,
      }),
    [authUserId, cfg.sessionIdSuffix]
  );

  const analyticsCtx = useMemo<ChatAnalyticsContext>(
    () => ({
      sessionId,
      sessionIdSuffix: cfg.sessionIdSuffix,
      teamName: cfg.teamName,
    }),
    [sessionId, cfg.sessionIdSuffix, cfg.teamName]
  );

  const postUrl = useMemo(() => resolveChatUrl(cfg.baseUrl), [cfg.baseUrl]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const setInput = useCallback((s: string) => {
    pendingLocalActivityRef.current = s.trim().length > 0;
    setInputState(s);
  }, []);

  const loadHistory = useCallback(async () => {
    const historyEndpoint = resolveHistoryUrl(cfg.baseUrl, effectiveUserId);

    setIsLoadingHistory(true);
    try {
      const fetchFn = cfg.fetchImpl ?? fetch;
      const res = await fetchFn(historyEndpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const raw = await res.json().catch(() => ({}));
      const sanitized = cfg.sanitizeHistory ? cfg.sanitizeHistory(raw) : raw;
      let normalized = normalizeHistoryMessages(sanitized);
      if (cfg.filterUiMessages) {
        normalized = cfg.filterUiMessages(normalized);
      }

      setMessages((prev) => {
        if (hasUserMessage(prev) || pendingLocalActivityRef.current) {
          return prev;
        }
        if (normalized.length > 0) {
          return normalized;
        }
        return [{ role: "assistant", content: cfg.greetingAssistantText }];
      });
    } catch {
      setMessages((prev) => {
        if (hasUserMessage(prev) || pendingLocalActivityRef.current) {
          return prev;
        }
        return [{ role: "assistant", content: cfg.greetingAssistantText }];
      });
    } finally {
      setIsLoadingHistory(false);
      setHistoryInitialized(true);
    }
  }, [cfg, effectiveUserId]);

  useEffect(() => {
    if (!isOpen) {
      historyRequestedRef.current = false;
      return;
    }
    if (historyRequestedRef.current) return;
    historyRequestedRef.current = true;
    void loadHistory();
  }, [isOpen, loadHistory]);

  const setIsOpenTracked = useCallback(
    (v: boolean) => {
      setIsOpen(v);
      if (v) {
        cfg.onAnalytics?.({ type: "fab_open" }, analyticsCtx);
      } else {
        cfg.onAnalytics?.({ type: "panel_close" }, analyticsCtx);
      }
    },
    [cfg, analyticsCtx]
  );

  const sendMessage = useCallback(
    async (text?: string, opts?: SendMessageOptions) => {
      const raw = text ?? input;
      const trimmed = raw.trim();
      if (!trimmed || loading) return;

      setHasCommittedInteraction(true);
      pendingLocalActivityRef.current = false;

      const assistantBubble: ChatMessage = { role: "assistant", content: "" };

      if (!opts?.hideUserMessage) {
        const userBubble: ChatMessage = { role: "user", content: trimmed };
        setMessages((m) => [...m, userBubble, assistantBubble]);
      } else {
        setMessages((m) => [...m, assistantBubble]);
      }
      setInputState("");
      setLoading(true);

      cfg.onAnalytics?.(
        {
          type: "message_send",
          fromQuickQuestion: Boolean(opts?.fromQuickQuestion),
        },
        analyticsCtx
      );

      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userIdForBody = effectiveUserId;

      try {
        await streamChatResponse({
          url: postUrl,
          fetchImpl: cfg.fetchImpl,
          parseChunk: cfg.parseChunk,
          signal: controller.signal,
          body: {
            message: trimmed,
            user_id: userIdForBody,
            stream: true,
            monitor: DEFAULT_MONITOR,
            session_id: sessionId,
            team_name: cfg.teamName,
          },
          onParseChunk: (r) => {
            if (r.kind !== "assistant_sources" && r.kind !== "assistant_tool") {
              return;
            }
            setMessages((prev) => applyParseChunkToMessages(prev, r));
          },
          onDelta: (delta) => {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const next = [...prev];
              const last = next[next.length - 1];
              if (!last || last.role !== "assistant") return prev;
              next[next.length - 1] = {
                ...last,
                content: last.content + delta,
              };
              return next;
            });
          },
          onComplete: () => {
            setLoading(false);
          },
        });
      } catch (e: unknown) {
        const err = e as { name?: string };
        const isAbort = err?.name === "AbortError";
        if (isAbort) {
          setLoading(false);
          return;
        }
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const last = next[next.length - 1];
          if (!last || last.role !== "assistant") return prev;
          next[next.length - 1] = { ...last, content: errorText };
          return next;
        });
        setLoading(false);
      }
    },
    [
      input,
      loading,
      abort,
      effectiveUserId,
      postUrl,
      sessionId,
      cfg,
      analyticsCtx,
      errorText,
    ]
  );

  /** Optional: auto-send a hidden/context prompt when history is ready (e.g. loader flows). */
  const sendAutoMessageIfNeeded = useCallback(
    async (text: string) => {
      if (!historyInitialized || isLoadingHistory) return;
      if (cfg.shouldSkipAutoSend?.(messages)) return;
      await sendMessage(text, { hideUserMessage: true });
    },
    [cfg, historyInitialized, isLoadingHistory, messages, sendMessage]
  );

  const onQuickQuestion = useCallback(
    (question: string) => {
      cfg.onAnalytics?.(
        { type: "quick_question_click", question },
        analyticsCtx
      );
      void sendMessage(question, { fromQuickQuestion: true });
    },
    [cfg, analyticsCtx, sendMessage]
  );

  const welcomeQuickReplies =
    isOpen &&
    historyInitialized &&
    !isLoadingHistory &&
    !hasCommittedInteraction &&
    messages.length <= 1 &&
    (messages.length === 0 ||
      (messages.length === 1 && messages[0].role === "assistant"));

  const alwaysQuickReplies =
    isOpen &&
    historyInitialized &&
    !isLoadingHistory &&
    !loading &&
    (cfg.quickQuestions?.length ?? 0) > 0;

  const showQuickReplies =
    cfg.quickReplyBehavior === "always"
      ? alwaysQuickReplies
      : welcomeQuickReplies;

  return {
    messages,
    input,
    setInput,
    loading,
    isLoadingHistory,
    historyInitialized,
    isOpen,
    setIsOpen: setIsOpenTracked,
    sendMessage,
    sendAutoMessageIfNeeded,
    abort,
    showQuickReplies,
    quickQuestions: cfg.quickQuestions ?? [],
    onQuickQuestion,
    sessionId,
    effectiveUserId,
  };
}
