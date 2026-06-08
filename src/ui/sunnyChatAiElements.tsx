import { useMemo } from "react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import type {
  ChatMessage,
  ChatSource,
  ChatToolInvocation,
} from "../core/types.js";
import { SunnyChat } from "./SunnyChat.js";
import type { SunnyChatMessageListContext, SunnyChatProps } from "./SunnyChat.js";
import { ChatPendingReply } from "./ChatPendingReply.js";

function DefaultSourcesList({ sources }: { sources: ChatSource[] }) {
  return (
    <ul
      style={{
        margin: "8px 0 0",
        paddingLeft: 18,
        fontSize: 12,
        lineHeight: 1.4,
        color: "#52525b",
      }}
    >
      {sources.map((s, i) => (
        <li key={i} style={{ marginBottom: 4 }}>
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb" }}
            >
              {s.title}
            </a>
          ) : (
            s.title
          )}
        </li>
      ))}
    </ul>
  );
}

function DefaultToolBlock({ invocation: inv }: { invocation: ChatToolInvocation }) {
  const stateColor =
    inv.state === "error"
      ? "#b91c1c"
      : inv.state === "pending"
        ? "#a16207"
        : "#15803d";
  return (
    <div
      style={{
        marginBottom: 8,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #e4e4e7",
        background: "#fafafa",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        <span style={{ color: stateColor }}>{inv.state}</span>
        <span style={{ marginLeft: 8 }}>{inv.name}</span>
      </div>
      {inv.result ? (
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
          }}
        >
          {inv.result}
        </pre>
      ) : null}
    </div>
  );
}

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
  /** Citations / RAG sources — optional; a compact list is used when omitted. */
  MessageSources?: ComponentType<{
    className?: string;
    sources: ChatSource[];
  }>;
  /** Tool invocation row — optional; a compact block is used when omitted. */
  ToolInvocation?: ComponentType<{
    className?: string;
    invocation: ChatToolInvocation;
  }>;
  /** Optional custom loader inside the assistant bubble until the first text chunk arrives. */
  Loader?: ComponentType<{ className?: string }>;
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
    renderMessageList(messages: ChatMessage[], ctx: SunnyChatMessageListContext) {
      const {
        Conversation,
        ConversationContent,
        Message,
        MessageContent,
        MessageResponse,
      } = slots;
      const ScrollBtn = slots.ConversationScrollButton;
      const SourcesSlot = slots.MessageSources;
      const ToolSlot = slots.ToolInvocation;
      const LoaderSlot = slots.Loader;
      const lastIdx = messages.length - 1;

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
              {messages.map((m, i) => {
                const awaitingFirstChunk =
                  ctx.loading &&
                  i === lastIdx &&
                  m.role === "assistant" &&
                  !m.content.trim();

                return (
                <Message key={i} from={m.role}>
                  <MessageContent>
                    {m.role === "assistant" &&
                    m.toolInvocations &&
                    m.toolInvocations.length > 0
                      ? m.toolInvocations.map((inv, ti) =>
                          ToolSlot ? (
                            <ToolSlot
                              key={inv.id ?? `${i}-tool-${ti}`}
                              invocation={inv}
                            />
                          ) : (
                            <DefaultToolBlock
                              key={inv.id ?? `${i}-tool-${ti}`}
                              invocation={inv}
                            />
                          ),
                        )
                      : null}
                    {awaitingFirstChunk ? (
                      LoaderSlot ? (
                        <LoaderSlot />
                      ) : (
                        <ChatPendingReply />
                      )
                    ) : m.role === "assistant" || markdownUser ? (
                      <MessageResponse>{m.content}</MessageResponse>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                    )}
                    {m.sources && m.sources.length > 0 ? (
                      SourcesSlot ? (
                        <SourcesSlot sources={m.sources} />
                      ) : (
                        <DefaultSourcesList sources={m.sources} />
                      )
                    ) : null}
                  </MessageContent>
                </Message>
                );
              })}
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
                status={loading ? "streaming" : undefined}
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
