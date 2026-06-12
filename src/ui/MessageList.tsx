import type { ReactNode } from "react";
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
  messages: { role: "user" | "assistant"; content: string }[];
  /** When true, the last assistant bubble shows a typing indicator until content arrives. */
  loading?: boolean;
  renderAssistantContent?: (text: string) => ReactNode;
  /** Sent (user) bubble body; default is plain text in `.sunny-chat__text` */
  renderUserContent?: (text: string) => ReactNode;
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
        const awaitingFirstChunk =
          Boolean(loading) &&
          i === lastIdx &&
          m.role === "assistant" &&
          !m.content.trim();

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
              ) : renderAssistantContent ? (
                renderAssistantContent(m.content)
              ) : (
                <AssistantHtml content={m.content} />
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
