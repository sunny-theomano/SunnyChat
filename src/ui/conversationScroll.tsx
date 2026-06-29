import { createContext, useContext, type ReactNode } from "react";

export type ConversationScrollState = {
  messageCount: number;
  streaming: boolean;
};

const ConversationScrollContext = createContext<ConversationScrollState>({
  messageCount: 0,
  streaming: false,
});

export function ConversationScrollProvider({
  messageCount,
  streaming,
  children,
}: {
  messageCount: number;
  streaming: boolean;
  children: ReactNode;
}) {
  return (
    <ConversationScrollContext.Provider value={{ messageCount, streaming }}>
      {children}
    </ConversationScrollContext.Provider>
  );
}

/** Read scroll state from {@link SunnyChatAiElements} message list (builtin or custom Conversation). */
export function useConversationScrollState(): ConversationScrollState {
  return useContext(ConversationScrollContext);
}
