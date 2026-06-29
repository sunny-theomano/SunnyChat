export { useChatSession } from "./react/useChatSession.js";
export type {
  UseChatSessionConfig,
  SendMessageOptions,
} from "./react/useChatSession.js";

export { SunnyChat } from "./ui/SunnyChat.js";
export type {
  SunnyChatProps,
  SunnyChatUi,
  SunnyChatMessageListContext,
} from "./ui/SunnyChat.js";

export {
  SunnyChatAiElements,
  sunnyChatAiElementsRenderers,
  mergeSunnyChatAiElementsOptions,
} from "./ui/sunnyChatAiElements.js";
export type {
  SunnyChatAiElementsProps,
  SunnyChatAiElementsRenderersOptions,
  SunnyChatAiElementsSlots,
} from "./ui/sunnyChatAiElements.js";

export {
  builtinAiElementsSlots,
  BuiltinAiElementsMessageList,
  SunnyChatBuiltinAiElements,
} from "./ui/builtinAiElementsSlots.js";
export type {
  SunnyChatBuiltinAiElementsProps,
  SunnyChatBuiltinAiElementsUi,
  SunnyChatBuiltinThemeVars,
  BuiltinAiElementsMessageListProps,
} from "./ui/builtinAiElementsSlots.js";

export { MessageList } from "./ui/MessageList.js";
export type { MessageListProps, MessageListUi } from "./ui/MessageList.js";

export { ChatPendingReply } from "./ui/ChatPendingReply.js";

export { ChatComposer } from "./ui/ChatComposer.js";
export type { ChatComposerProps, ChatComposerUi } from "./ui/ChatComposer.js";

export type {
  ChatMessage,
  ChatRole,
  ChatSource,
  ChatToolInvocation,
  ChatAnalyticsEvent,
  ChatAnalyticsContext,
  ParseChunkResult,
  StreamEventPayload,
} from "./core/types.js";

export { generateAnonymousId, buildSessionId } from "./core/session.js";
export { normalizeHistoryMessages, hasUserMessage } from "./core/history.js";
export { defaultParseChunk, extractJsonBlocks } from "./core/parseSse.js";
export {
  streamChatResponse,
  resolveChatUrl,
  resolveHistoryUrl,
} from "./core/streamChat.js";
export type { StreamChatBody, StreamChatParams } from "./core/streamChat.js";

export { useMarkedHtml } from "./ui/markdown.js";

export {
  ConversationScrollProvider,
  useConversationScrollState,
} from "./ui/conversationScroll.js";
export type { ConversationScrollState } from "./ui/conversationScroll.js";
export type { SunnyChatConversationScrollProps } from "./ui/conversationScroll.js";
