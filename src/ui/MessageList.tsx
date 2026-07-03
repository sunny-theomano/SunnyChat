import type { ReactNode } from "react";
import type { ChatMessage, ChatToolInvocation } from "../core/types.js";
import { ChatPendingReply } from "./ChatPendingReply.js";
import { useMarkedHtml } from "./markdown.js";

const ROOT = "sunny-chat";

export type MessageListUi = {
  /** Appended to `.sunny-chat__messages` */
  className?: string;
  userRowClassName?: string;
  assistantRowClassName?: string;
  userBubbleClassName?: string;
  assistantBubbleClassName?: string;
};

export type MessageListProps = {
  messages: ChatMessage[];
  /** When true, the last assistant bubble shows a typing indicator until content arrives. */
  loading?: boolean;
  renderAssistantContent?: (text: string) => ReactNode;
  /** Sent (user) bubble body; default is plain text in `.sunny-chat__text` */
  renderUserContent?: (text: string) => ReactNode;
  renderToolInvocation?: (invocation: ChatToolInvocation) => ReactNode;
  ui?: MessageListUi;
};

function cx(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function MessageList({
  messages,
  loading = false,
  renderAssistantContent,
  renderUserContent,
  renderToolInvocation,
  ui,
}: MessageListProps) {
  const lastIdx = messages.length - 1;

  return (
    <div
      className={cx(`${ROOT}__messages`, ui?.className)}
      role="log"
      aria-live="polite"
    >
      {messages.map((m, i) => {
        const toolInvocations =
          m.role === "assistant" && m.toolInvocations?.length ? m.toolInvocations : [];
        const hasAssistantBody = Boolean(m.content.trim()) || toolInvocations.length > 0;
        const awaitingFirstChunk =
          Boolean(loading) &&
          i === lastIdx &&
          m.role === "assistant" &&
          !hasAssistantBody;

        return (
        <div
          key={i}
          className={cx(
            `${ROOT}__row`,
            `${ROOT}__row--${m.role}`,
            m.role === "user" ? ui?.userRowClassName : ui?.assistantRowClassName,
          )}
          data-role={m.role}
        >
          <div
            className={cx(
              `${ROOT}__bubble`,
              m.role === "user"
                ? ui?.userBubbleClassName
                : ui?.assistantBubbleClassName,
            )}
          >
            {m.role === "assistant" ? (
              awaitingFirstChunk ? (
                <ChatPendingReply />
              ) : (
                <>
                  {toolInvocations.map((inv, ti) =>
                    renderToolInvocation ? (
                      <div key={inv.id ?? `${i}-tool-${ti}`}>
                        {renderToolInvocation(inv)}
                      </div>
                    ) : (
                      <DefaultToolInvocation
                        key={inv.id ?? `${i}-tool-${ti}`}
                        invocation={inv}
                      />
                    ),
                  )}
                  {m.content.trim() ? (
                    renderAssistantContent ? (
                      renderAssistantContent(m.content)
                    ) : (
                      <AssistantHtml content={m.content} />
                    )
                  ) : null}
                </>
              )
            ) : renderUserContent ? (
              renderUserContent(m.content)
            ) : (
              <span className={`${ROOT}__text`}>{m.content}</span>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function DefaultToolInvocation({ invocation: inv }: { invocation: ChatToolInvocation }) {
  const stateClass =
    inv.state === "pending"
      ? `${ROOT}__toolState--pending`
      : inv.state === "error"
        ? `${ROOT}__toolState--error`
        : `${ROOT}__toolState--complete`;

  return (
    <div className={`${ROOT}__tool`}>
      <div className={`${ROOT}__toolHead`}>
        <span className={cx(`${ROOT}__toolState`, stateClass)}>{inv.state}</span>
        <span>{inv.name}</span>
      </div>
      {inv.result ? <pre className={`${ROOT}__toolPre`}>{inv.result}</pre> : null}
    </div>
  );
}

function AssistantHtml({ content }: { content: string }) {
  const html = useMarkedHtml(content || "");
  return (
    <div
      className={`${ROOT}__md`}
      // eslint-disable-next-line react/no-danger -- documented; host may override renderAssistantContent
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
