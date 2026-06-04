import type { ReactNode } from "react";
import { useMarkedHtml } from "./markdown.js";

const ROOT = "sunny-chat";

export type MessageListProps = {
  messages: { role: "user" | "assistant"; content: string }[];
  renderAssistantContent?: (text: string) => ReactNode;
};

export function MessageList({
  messages,
  renderAssistantContent,
}: MessageListProps) {
  return (
    <div className={`${ROOT}__messages`} role="log" aria-live="polite">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`${ROOT}__row ${ROOT}__row--${m.role}`}
          data-role={m.role}
        >
          <div className={`${ROOT}__bubble`}>
            {m.role === "assistant" ? (
              renderAssistantContent ? (
                renderAssistantContent(m.content)
              ) : (
                <AssistantHtml content={m.content} />
              )
            ) : (
              <span className={`${ROOT}__text`}>{m.content}</span>
            )}
          </div>
        </div>
      ))}
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
