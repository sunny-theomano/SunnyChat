import { useMemo } from "react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import type { ChatMessage } from "../core/types.js";
import { SunnyChat } from "./SunnyChat.js";
import type { SunnyChatProps } from "./SunnyChat.js";

/**
 * Components from your app’s AI Elements install (e.g. `npx ai-elements@latest` / shadcn registry).
 * Paths are typically `@/components/ai-elements/...` — see https://elements.ai-sdk.dev
 */
export type SunnyChatAiElementsSlots = {
  Conversation: ComponentType<{
    className?: string;
    children?: ReactNode;
    role?: string;
  }>;
  ConversationContent: ComponentType<{
    className?: string;
    children?: ReactNode;
  }>;
  Message: ComponentType<{ from: "user" | "assistant"; children?: ReactNode }>;
  MessageContent: ComponentType<{ children?: ReactNode }>;
  MessageResponse: ComponentType<{ children?: ReactNode }>;
  PromptInput: ComponentType<{
    className?: string;
    onSubmit: (
      message: { text: string },
      event: FormEvent<HTMLFormElement>,
    ) => void | Promise<void>;
    children?: ReactNode;
  }>;
  PromptInputBody: ComponentType<{ className?: string; children?: ReactNode }>;
  PromptInputTextarea: ComponentType<{
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }>;
  PromptInputFooter: ComponentType<{ className?: string; children?: ReactNode }>;
  PromptInputSubmit: ComponentType<{
    disabled?: boolean;
    status?: "submitted" | "streaming" | "error";
    className?: string;
  }>;
  ConversationScrollButton?: ComponentType<{ className?: string }>;
  PromptInputTools?: ComponentType<{
    className?: string;
    children?: ReactNode;
  }>;
};

export type SunnyChatAiElementsRenderersOptions = {
  conversationClassName?: string;
  promptInputClassName?: string;
  /** When false, user bubbles are plain text (no markdown). Default true. */
  markdownUserMessages?: boolean;
};

export function sunnyChatAiElementsRenderers(
  slots: SunnyChatAiElementsSlots,
  options?: SunnyChatAiElementsRenderersOptions,
): Pick<SunnyChatProps, "renderMessageList" | "renderComposer"> {
  const markdownUser = options?.markdownUserMessages !== false;

  return {
    renderMessageList(messages: ChatMessage[]) {
      const {
        Conversation,
        ConversationContent,
        Message,
        MessageContent,
        MessageResponse,
      } = slots;
      const ScrollBtn = slots.ConversationScrollButton;

      return (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Conversation
            className={options?.conversationClassName}
            role="log"
          >
            <ConversationContent>
              {messages.map((m, i) => (
                <Message key={i} from={m.role}>
                  <MessageContent>
                    {m.role === "assistant" || markdownUser ? (
                      <MessageResponse>{m.content}</MessageResponse>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                    )}
                  </MessageContent>
                </Message>
              ))}
            </ConversationContent>
            {ScrollBtn ? <ScrollBtn /> : null}
          </Conversation>
        </div>
      );
    },
    renderComposer({
      quickSlot,
      sendText,
      loading,
      composerPlaceholder,
    }) {
      const {
        PromptInput,
        PromptInputBody,
        PromptInputTextarea,
        PromptInputFooter,
        PromptInputSubmit,
      } = slots;
      const Tools = slots.PromptInputTools;

      return (
        <PromptInput
          className={options?.promptInputClassName}
          onSubmit={({ text }) => {
            const trimmed = text.trim();
            if (!trimmed || loading) return;
            void sendText(trimmed);
          }}
        >
          {quickSlot}
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={composerPlaceholder}
              disabled={loading}
            />
            <PromptInputFooter>
              {Tools ? <Tools /> : null}
              <PromptInputSubmit
                disabled={loading}
                status={loading ? "submitted" : undefined}
              />
            </PromptInputFooter>
          </PromptInputBody>
        </PromptInput>
      );
    },
  };
}

export type SunnyChatAiElementsProps = Omit<
  SunnyChatProps,
  "renderMessageList" | "renderComposer"
> & {
  aiElements: SunnyChatAiElementsSlots;
  aiElementsOptions?: SunnyChatAiElementsRenderersOptions;
};

/**
 * Same as {@link SunnyChat}, but wires [Vercel AI Elements](https://elements.ai-sdk.dev)
 * conversation + message list and prompt input. Install AI Elements in your app, then pass
 * the generated components via `aiElements`.
 */
export function SunnyChatAiElements({
  aiElements,
  aiElementsOptions,
  ...props
}: SunnyChatAiElementsProps) {
  const { renderMessageList, renderComposer } = useMemo(
    () => sunnyChatAiElementsRenderers(aiElements, aiElementsOptions),
    [aiElements, aiElementsOptions],
  );

  return (
    <SunnyChat
      {...props}
      renderMessageList={renderMessageList}
      renderComposer={renderComposer}
    />
  );
}
