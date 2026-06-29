import type { ChatAnalyticsContext, ChatAnalyticsEvent, ChatMessage, ChatToolInvocation } from "../core/types.js";

export type RealtimeConnectionState =
  | "disconnected"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

export type RealtimeChatAnalyticsEvent =
  | ChatAnalyticsEvent
  | { type: "realtime_connect" }
  | { type: "realtime_disconnect" }
  | { type: "realtime_error"; message: string };

export type RealtimeChatAnalyticsContext = ChatAnalyticsContext;

export type RealtimeDataChannelEventMap = {
  open: Event;
  close: Event;
  error: Event;
  message: MessageEvent<string> | { data: string };
};

export type RealtimeDataChannelLike = {
  readyState: string;
  send: (data: string) => void;
  close?: () => void;
  addEventListener: <K extends keyof RealtimeDataChannelEventMap>(
    type: K,
    listener: (event: RealtimeDataChannelEventMap[K]) => void,
  ) => void;
};

export type RealtimeMediaTrackLike = {
  stop: () => void;
};

export type RealtimeMediaStreamLike = {
  getTracks: () => RealtimeMediaTrackLike[];
};

export type RealtimeTrackEventLike = {
  streams: unknown[];
};

export type RealtimePeerConnectionLike = {
  createDataChannel: (label: string) => RealtimeDataChannelLike;
  createOffer: () => Promise<{ sdp?: string | null }>;
  setLocalDescription: (desc: { type: string; sdp?: string | null }) => Promise<void>;
  setRemoteDescription: (desc: { type: string; sdp: string }) => Promise<void>;
  addTrack: (track: RealtimeMediaTrackLike, stream: RealtimeMediaStreamLike) => void;
  close: () => void;
  ontrack: ((event: RealtimeTrackEventLike) => void) | null;
};

export type RealtimeAudioElementLike = {
  autoplay: boolean;
  srcObject?: unknown;
};

export type RealtimeToolHandlerContext = {
  userId: string;
};

export type RealtimeToolHandler = (
  args: unknown,
  context: RealtimeToolHandlerContext,
) => Promise<string>;

export type RealtimeChatSessionConfig = {
  getUserId: () => string | null;
  sessionIdSuffix?: string;
  teamName?: string;
  getSessionToken?: (userId: string) => Promise<string>;
  sessionTokenEndpoint?: string;
  toolHandlers?: Record<string, RealtimeToolHandler>;
  initialInstructions?: string;
  onAnalytics?: (
    event: RealtimeChatAnalyticsEvent,
    context: RealtimeChatAnalyticsContext,
  ) => void;
  fetchImpl?: typeof fetch;
  openAiBaseUrl?: string;
  rtcFactories?: {
    createPeerConnection?: () => RealtimePeerConnectionLike;
    getUserMedia?: () => Promise<RealtimeMediaStreamLike>;
    createAudioElement?: () => RealtimeAudioElementLike;
  };
};

export type RealtimeChatSessionSnapshot = {
  messages: ChatMessage[];
  toolInvocations: ChatToolInvocation[];
  connectionState: RealtimeConnectionState;
  error: string | null;
  isConnected: boolean;
  isResponding: boolean;
  effectiveUserId: string;
};

export type RealtimeChatSession = {
  getSnapshot: () => RealtimeChatSessionSnapshot;
  subscribe: (listener: (snapshot: RealtimeChatSessionSnapshot) => void) => () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => boolean;
  updateConfig: (config: RealtimeChatSessionConfig) => void;
};
