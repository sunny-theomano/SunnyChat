import { buildSessionId, generateAnonymousId } from "../core/session.js";
import type { ChatMessage, ChatToolInvocation } from "../core/types.js";
import { createDefaultVoiceToolHandlers, resolveVoiceSessionUrl } from "./voiceApi.js";
import type {
  RealtimeAudioElementLike,
  RealtimeChatSession,
  RealtimeChatSessionConfig,
  RealtimeChatSessionSnapshot,
  RealtimeConnectionState,
  RealtimeDataChannelLike,
  RealtimeMediaStreamLike,
  RealtimePeerConnectionLike,
  RealtimeToolHandler,
} from "./types.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_SESSION_SUFFIX = "_realtime";
const DEFAULT_TEAM_NAME = "realtime-team";

type SessionState = {
  messages: ChatMessage[];
  toolInvocations: ChatToolInvocation[];
  connectionState: RealtimeConnectionState;
  error: string | null;
  isResponding: boolean;
};

type RealtimeEvent = Record<string, unknown>;

function defaultCreatePeerConnection(): RealtimePeerConnectionLike {
  return new RTCPeerConnection() as unknown as RealtimePeerConnectionLike;
}

async function defaultGetUserMedia(): Promise<RealtimeMediaStreamLike> {
  return navigator.mediaDevices.getUserMedia({ audio: true }) as Promise<RealtimeMediaStreamLike>;
}

function defaultCreateAudioElement(): RealtimeAudioElementLike {
  const audio = new Audio();
  audio.autoplay = true;
  return audio as unknown as RealtimeAudioElementLike;
}

function resolveText(event: RealtimeEvent, keys: string[]): string {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function eventOutputKey(event: RealtimeEvent): string {
  const responseId = typeof event.response_id === "string" ? event.response_id : "response";
  const itemId = typeof event.item_id === "string" ? event.item_id : typeof event.output_item_id === "string" ? event.output_item_id : "item";
  const contentIndex =
    typeof event.content_index === "number"
      ? String(event.content_index)
      : typeof event.output_index === "number"
        ? String(event.output_index)
        : "0";
  return `${responseId}:${itemId}:${contentIndex}`;
}

function ensureAssistantDraft(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant") return messages;
  return [...messages, { role: "assistant", content: "" }];
}

function appendAssistantText(messages: ChatMessage[], text: string): ChatMessage[] {
  if (!text) return messages;
  const next = ensureAssistantDraft(messages).slice();
  const last = next[next.length - 1];
  next[next.length - 1] = {
    ...last,
    content: `${last.content}${text}`,
  };
  return next;
}

function upsertToolInvocations(
  list: ChatToolInvocation[],
  tool: ChatToolInvocation,
): ChatToolInvocation[] {
  if (tool.id) {
    const idx = list.findIndex((item) => item.id === tool.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = { ...next[idx], ...tool };
      return next;
    }
  }
  return [...list, tool];
}

function syncLastAssistantTools(
  messages: ChatMessage[],
  tools: ChatToolInvocation[],
): ChatMessage[] {
  if (messages.length === 0) return messages;
  const next = ensureAssistantDraft(messages).slice();
  const last = next[next.length - 1];
  if (last.role !== "assistant") return next;
  next[next.length - 1] = {
    ...last,
    toolInvocations: tools,
  };
  return next;
}

function buildSessionTokenRequestUrl(endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  if (typeof window !== "undefined") {
    return new URL(endpoint, window.location.origin).toString();
  }
  return endpoint;
}

export function createRealtimeChatSession(initialConfig: RealtimeChatSessionConfig): RealtimeChatSession {
  let config = initialConfig;
  const listeners = new Set<(snapshot: RealtimeChatSessionSnapshot) => void>();
  let state: SessionState = {
    messages: [],
    toolInvocations: [],
    connectionState: "disconnected",
    error: null,
    isResponding: false,
  };

  let anonymousId = generateAnonymousId();
  let peerConnection: RealtimePeerConnectionLike | null = null;
  let dataChannel: RealtimeDataChannelLike | null = null;
  let mediaStream: RealtimeMediaStreamLike | null = null;
  let audioElement: RealtimeAudioElementLike | null = null;
  let connectPromise: Promise<void> | null = null;
  let intentionalDisconnect = false;
  const pendingToolCalls = new Map<string, { name: string; args: string }>();
  const expectedToolCallIds = new Set<string>();
  const completedToolCallIds = new Set<string>();
  const dispatchedToolCallIds = new Set<string>();
  const outputItemTypes = new Map<string, string>();
  const assistantBuffers = new Map<string, string>();
  let responseDoneReceived = false;
  let followUpRequested = false;

  const fetchImpl = () => config.fetchImpl ?? fetch;

  const getEffectiveToolHandlers = (): Record<string, RealtimeToolHandler> => {
    const custom = config.toolHandlers ?? {};
    if (!config.baseUrl?.trim()) return custom;
    return {
      ...createDefaultVoiceToolHandlers({
        baseUrl: config.baseUrl,
        fetchImpl: fetchImpl(),
      }),
      ...custom,
    };
  };

  const getEffectiveUserId = () => {
    const authUserId = config.getUserId()?.trim() || null;
    return authUserId ?? anonymousId;
  };

  const getAnalyticsContext = () => ({
    sessionId: buildSessionId({
      userId: config.getUserId()?.trim() || null,
      anonymousId,
      sessionIdSuffix: config.sessionIdSuffix ?? DEFAULT_SESSION_SUFFIX,
    }),
    sessionIdSuffix: config.sessionIdSuffix ?? DEFAULT_SESSION_SUFFIX,
    teamName: config.teamName ?? DEFAULT_TEAM_NAME,
  });

  const snapshot = (): RealtimeChatSessionSnapshot => ({
    ...state,
    isConnected:
      state.connectionState === "listening" || state.connectionState === "speaking",
    effectiveUserId: getEffectiveUserId(),
  });

  const emit = () => {
    const next = snapshot();
    for (const listener of listeners) {
      listener(next);
    }
  };

  const setState = (updater: Partial<SessionState> | ((prev: SessionState) => SessionState)) => {
    state = typeof updater === "function" ? updater(state) : { ...state, ...updater };
    emit();
  };

  const trackError = (message: string) => {
    config.onAnalytics?.({ type: "realtime_error", message }, getAnalyticsContext());
  };

  const sendEvent = (eventObj: Record<string, unknown>): boolean => {
    if (!dataChannel || dataChannel.readyState !== "open") {
      return false;
    }
    dataChannel.send(JSON.stringify(eventObj));
    return true;
  };

  const teardown = (nextConnectionState: RealtimeConnectionState, error: string | null) => {
    intentionalDisconnect = true;
    try {
      dataChannel?.close?.();
    } catch {
      // ignore close errors from test doubles / browser impls
    }
    try {
      peerConnection?.close();
    } catch {
      // ignore close errors
    }
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        track.stop();
      }
    }

    peerConnection = null;
    dataChannel = null;
    mediaStream = null;
    audioElement = null;
    connectPromise = null;
    pendingToolCalls.clear();
    expectedToolCallIds.clear();
    completedToolCallIds.clear();
    dispatchedToolCallIds.clear();
    outputItemTypes.clear();
    assistantBuffers.clear();
    responseDoneReceived = false;
    followUpRequested = false;

    setState((prev) => ({
      ...prev,
      connectionState: nextConnectionState,
      error,
      isResponding: false,
    }));
  };

  const checkAndTriggerResponse = () => {
    if (!responseDoneReceived || expectedToolCallIds.size > 0 || followUpRequested) {
      if (responseDoneReceived && expectedToolCallIds.size === 0) {
        setState((prev) => ({ ...prev, isResponding: false }));
      }
      return;
    }
    if (completedToolCallIds.size > 0) {
      followUpRequested = sendEvent({ type: "response.create" });
      if (!followUpRequested) {
        setState((prev) => ({ ...prev, isResponding: false }));
      }
      return;
    }
    setState((prev) => ({ ...prev, isResponding: false }));
  };

  const registerOutputItem = (item: Record<string, unknown> | null | undefined) => {
    if (!item) return;
    const itemId = typeof item.id === "string" ? item.id : "";
    const itemType = typeof item.type === "string" ? item.type : "";
    if (itemId && itemType) {
      outputItemTypes.set(itemId, itemType);
    }
  };

  const isFunctionCallTextEvent = (event: RealtimeEvent): boolean => {
    const itemId = typeof event.item_id === "string" ? event.item_id : "";
    return Boolean(itemId && outputItemTypes.get(itemId) === "function_call");
  };

  const queueToolDispatch = (callId: string, name: string, argsStr: string) => {
    if (!callId || dispatchedToolCallIds.has(callId)) return;
    dispatchedToolCallIds.add(callId);
    pendingToolCalls.delete(callId);
    void dispatchTool(callId, name, argsStr);
  };

  const dispatchTool = async (callId: string, name: string, argsStr: string) => {
    let args: unknown = {};
    try {
      args = argsStr ? JSON.parse(argsStr) : {};
    } catch {
      args = {};
    }

    const handler = getEffectiveToolHandlers()[name];
    let output = `Unknown tool: ${name}`;
    let toolState: ChatToolInvocation["state"] = "error";
    try {
      if (handler) {
        output = await handler(args, { userId: getEffectiveUserId() });
        toolState = "complete";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output = `Error executing tool: ${message}`;
      toolState = "error";
    }

    setState((prev) => {
      const toolInvocations = upsertToolInvocations(prev.toolInvocations, {
        id: callId,
        name,
        state: toolState,
        args,
        result: output,
      });
      return {
        ...prev,
        toolInvocations,
        messages: syncLastAssistantTools(prev.messages, toolInvocations),
      };
    });

    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });

    completedToolCallIds.add(callId);
    expectedToolCallIds.delete(callId);
    checkAndTriggerResponse();
  };

  const handleAssistantText = (event: RealtimeEvent, candidateKeys: string[]) => {
    if (isFunctionCallTextEvent(event)) return;
    const text = resolveText(event, candidateKeys);
    if (!text) return;
    const key = eventOutputKey(event);
    const buffered = assistantBuffers.get(key) ?? "";
    let delta = text;

    if (typeof event.type === "string" && event.type.endsWith(".done")) {
      if (text.startsWith(buffered)) {
        delta = text.slice(buffered.length);
      }
      assistantBuffers.delete(key);
    } else {
      assistantBuffers.set(key, `${buffered}${text}`);
    }

    if (!delta) return;
    setState((prev) => ({
      ...prev,
      messages: appendAssistantText(prev.messages, delta),
    }));
  };

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    const type = typeof event.type === "string" ? event.type : "";

    if (type === "response.audio.done" || type === "response.output_audio.done") {
      setState((prev) => ({
        ...prev,
        connectionState: prev.connectionState === "error" ? prev.connectionState : "listening",
      }));
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const transcript = resolveText(event, ["transcript"]);
      if (transcript) {
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, { role: "user", content: transcript }],
        }));
      }
      return;
    }

    if (
      type === "response.output_text.delta" ||
      type === "response.audio_transcript.delta" ||
      type === "response.output_audio_transcript.delta"
    ) {
      handleAssistantText(event, ["delta", "text", "transcript"]);
      return;
    }

    if (
      type === "response.output_text.done" ||
      type === "response.audio_transcript.done" ||
      type === "response.output_audio_transcript.done"
    ) {
      handleAssistantText(event, ["text", "transcript", "delta"]);
      return;
    }

    if (type === "response.function_call_arguments.delta") {
      const callId = typeof event.call_id === "string" ? event.call_id : "";
      if (!callId) return;
      const existing = pendingToolCalls.get(callId) ?? {
        name: typeof event.name === "string" ? event.name : "tool",
        args: "",
      };
      existing.args += typeof event.delta === "string" ? event.delta : "";
      pendingToolCalls.set(callId, existing);

      setState((prev) => {
        const toolInvocations = upsertToolInvocations(prev.toolInvocations, {
          id: callId,
          name: existing.name,
          state: "pending",
          result: undefined,
        });
        return {
          ...prev,
          toolInvocations,
          messages: syncLastAssistantTools(prev.messages, toolInvocations),
        };
      });
      return;
    }

    if (type === "response.function_call_arguments.done") {
      const callId = typeof event.call_id === "string" ? event.call_id : "";
      if (!callId) return;
      const existing = pendingToolCalls.get(callId) ?? {
        name: typeof event.name === "string" ? event.name : "tool",
        args: "",
      };
      queueToolDispatch(
        callId,
        typeof event.name === "string" ? event.name : existing.name,
        typeof event.arguments === "string" ? event.arguments : existing.args,
      );
      return;
    }

    if (type === "response.output_item.added" || type === "response.output_item.done") {
      const item =
        typeof event.item === "object" && event.item ? (event.item as Record<string, unknown>) : null;
      registerOutputItem(item);
      const itemType = typeof item?.type === "string" ? item.type : "";
      if (itemType === "function_call") {
        const callId = typeof item?.call_id === "string" ? item.call_id : "";
        const name = typeof item?.name === "string" ? item.name : "tool";
        const args = typeof item?.arguments === "string" ? item.arguments : "";
        if (type === "response.output_item.done" && callId) {
          queueToolDispatch(callId, name, args);
        }
        return;
      }
      if (itemType === "function_call_output") {
        return;
      }
    }

    if (type === "response.created") {
      expectedToolCallIds.clear();
      completedToolCallIds.clear();
      dispatchedToolCallIds.clear();
      outputItemTypes.clear();
      responseDoneReceived = false;
      followUpRequested = false;
      setState((prev) => ({
        ...prev,
        isResponding: true,
        toolInvocations: [],
        messages: ensureAssistantDraft(prev.messages),
      }));
      return;
    }

    if (type === "response.done") {
      responseDoneReceived = true;
      const response = typeof event.response === "object" && event.response ? event.response as { output?: unknown[] } : null;
      const outputItems = Array.isArray(response?.output) ? response.output : [];
      for (const item of outputItems) {
        if (!item || typeof item !== "object") continue;
        const outputItem = item as Record<string, unknown>;
        registerOutputItem(outputItem);
        if (outputItem.type === "function_call" && typeof outputItem.call_id === "string") {
          const callId = outputItem.call_id;
          if (!completedToolCallIds.has(callId)) {
            expectedToolCallIds.add(callId);
          }
          if (
            typeof outputItem.arguments === "string" &&
            !dispatchedToolCallIds.has(callId)
          ) {
            queueToolDispatch(
              callId,
              typeof outputItem.name === "string" ? outputItem.name : "tool",
              outputItem.arguments,
            );
          }
        }
      }
      checkAndTriggerResponse();
    }
  };

  const connect = async () => {
    if (connectPromise) return connectPromise;
    if (state.connectionState === "listening" || state.connectionState === "speaking") {
      return;
    }

    intentionalDisconnect = false;
    setState((prev) => ({ ...prev, connectionState: "connecting", error: null }));

    connectPromise = (async () => {
      const effectiveUserId = getEffectiveUserId();
      try {
        const token = config.getSessionToken
          ? await config.getSessionToken(effectiveUserId)
          : await (async () => {
              const endpoint = config.sessionTokenEndpoint
                ?? (config.baseUrl?.trim() ? resolveVoiceSessionUrl(config.baseUrl) : undefined);
              if (!endpoint) {
                throw new Error("Missing getSessionToken, sessionTokenEndpoint, or baseUrl");
              }
              const res = await fetchImpl()(buildSessionTokenRequestUrl(endpoint), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: effectiveUserId }),
              });
              if (!res.ok) {
                throw new Error(`Failed to get session token: ${await res.text()}`);
              }
              const data = await res.json() as { value?: string; client_secret?: { value?: string } };
              const value = data.value ?? data.client_secret?.value;
              if (!value) {
                throw new Error("Session token response missing token value");
              }
              return value;
            })();

        const createPeerConnection = config.rtcFactories?.createPeerConnection ?? defaultCreatePeerConnection;
        const getUserMedia = config.rtcFactories?.getUserMedia ?? defaultGetUserMedia;
        const createAudioElement = config.rtcFactories?.createAudioElement ?? defaultCreateAudioElement;

        peerConnection = createPeerConnection();
        audioElement = createAudioElement();
        audioElement.autoplay = true;
        peerConnection.ontrack = (evt) => {
          audioElement!.srcObject = evt.streams[0];
          setState((prev) => ({ ...prev, connectionState: "speaking" }));
        };

        dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannel.addEventListener("message", (evt) => {
          try {
            const payload = JSON.parse(evt.data) as RealtimeEvent;
            handleRealtimeEvent(payload);
          } catch {
            // ignore malformed event payloads
          }
        });
        dataChannel.addEventListener("close", () => {
          if (!intentionalDisconnect) {
            teardown("disconnected", null);
          }
        });
        dataChannel.addEventListener("error", () => {
          const message = "Realtime data channel error";
          trackError(message);
          teardown("error", message);
        });
        dataChannel.addEventListener("open", () => {
          if (config.initialInstructions) {
            sendEvent({
              type: "response.create",
              response: {
                instructions: config.initialInstructions,
              },
            });
          }
        });

        mediaStream = await getUserMedia();
        for (const track of mediaStream.getTracks()) {
          peerConnection.addTrack(track, mediaStream);
        }

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription({ type: "offer", sdp: offer.sdp ?? "" });
        const sdpResponse = await fetchImpl()(config.openAiBaseUrl ?? DEFAULT_OPENAI_BASE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        });

        if (!sdpResponse.ok) {
          throw new Error(`SDP exchange failed: ${await sdpResponse.text()}`);
        }

        const answerSdp = await sdpResponse.text();
        await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

        setState((prev) => ({ ...prev, connectionState: "listening", error: null }));
        config.onAnalytics?.({ type: "realtime_connect" }, getAnalyticsContext());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackError(message);
        teardown("error", message);
        throw error;
      } finally {
        connectPromise = null;
      }
    })();

    return connectPromise;
  };

  const disconnect = () => {
    config.onAnalytics?.({ type: "realtime_disconnect" }, getAnalyticsContext());
    teardown("disconnected", null);
  };

  const sendText = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (!dataChannel || dataChannel.readyState !== "open") {
      setState((prev) => ({ ...prev, error: "Connect the voice session before sending messages." }));
      return false;
    }

    setState((prev) => ({
      ...prev,
      error: null,
      messages: [...prev.messages, { role: "user", content: trimmed }],
    }));

    const created = sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: trimmed }],
      },
    });
    if (!created) return false;
    sendEvent({ type: "response.create" });
    return true;
  };

  return {
    getSnapshot: snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    connect,
    disconnect,
    sendText,
    updateConfig: (nextConfig) => {
      config = nextConfig;
    },
  };
}
