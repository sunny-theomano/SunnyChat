import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useChatSession } from "../react/useChatSession.js";
import type { UseChatSessionConfig } from "../react/useChatSession.js";
import type { ChatMessage } from "../core/types.js";
import { ChatComposer } from "./ChatComposer.js";
import type { ChatComposerUi } from "./ChatComposer.js";
import { MessageList } from "./MessageList.js";
import type { MessageListUi } from "./MessageList.js";

const ROOT = "sunny-chat";

const DEFAULT_STYLE_ID = "sunny-chat-default-theme";

const defaultCss = `
.${ROOT} {
  --chat-user-bg: #2563eb;
  --chat-user-fg: #fff;
  --chat-assistant-bg: #f4f4f5;
  --chat-assistant-fg: #18181b;
  --chat-radius: 12px;
  --chat-panel-bg: #ffffff;
  --chat-panel-border: #e4e4e7;
  --chat-fab-bg: #2563eb;
  --chat-fab-fg: #fff;
  --chat-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: #18181b;
}
.${ROOT}__fab {
  position: fixed;
  z-index: 2147483000;
  bottom: 20px;
  right: 20px;
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  cursor: pointer;
  background: var(--chat-fab-bg);
  color: var(--chat-fab-fg);
  box-shadow: var(--chat-shadow);
  font-weight: 600;
}
.${ROOT}__backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
  background: rgba(15, 23, 42, 0.25);
}
.${ROOT}__panel {
  position: fixed;
  z-index: 2147483002;
  bottom: 20px;
  right: 20px;
  width: min(400px, calc(100vw - 32px));
  height: min(560px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  background: var(--chat-panel-bg);
  border: 1px solid var(--chat-panel-border);
  border-radius: var(--chat-radius);
  box-shadow: var(--chat-shadow);
  overflow: hidden;
}
.${ROOT}__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--chat-panel-border);
  font-weight: 600;
}
.${ROOT}__close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 4px 8px;
  color: #52525b;
}
.${ROOT}__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 12px;
}
.${ROOT}__skeleton {
  padding: 16px;
  color: #71717a;
  font-size: 13px;
}
.${ROOT}__messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.${ROOT}__row {
  display: flex;
}
.${ROOT}__row--user { justify-content: flex-end; }
.${ROOT}__row--assistant { justify-content: flex-start; }
.${ROOT}__bubble {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: var(--chat-radius);
  word-break: break-word;
}
.${ROOT}__row--user .${ROOT}__bubble {
  background: var(--chat-user-bg);
  color: var(--chat-user-fg);
}
.${ROOT}__row--assistant .${ROOT}__bubble {
  background: var(--chat-assistant-bg);
  color: var(--chat-assistant-fg);
}
.${ROOT}__tool {
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--chat-panel-border, #e4e4e7);
  background: #fafafa;
  font-size: 12px;
  line-height: 1.4;
}
.${ROOT}__toolHead { font-weight: 600; margin-bottom: 4px; }
.${ROOT}__toolState { font-weight: 500; margin-right: 8px; }
.${ROOT}__toolState--pending { color: #a16207; }
.${ROOT}__toolState--complete { color: #15803d; }
.${ROOT}__toolState--error { color: #b91c1c; }
.${ROOT}__toolPre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}
.${ROOT}__md p { margin: 0 0 0.5em; }
.${ROOT}__md p:last-child { margin-bottom: 0; }
.${ROOT}__md a { color: inherit; text-decoration: underline; }
.${ROOT}__md pre.sunny-chat-md-pre {
  margin: 0.5em 0;
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
  background: #1e1e2e;
  color: #cdd6f4;
  font-size: 12px;
  line-height: 1.45;
}
.${ROOT}__md pre.sunny-chat-md-pre code.hljs {
  background: transparent;
  padding: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.${ROOT}__md .hljs-keyword { color: #cba6f7; }
.${ROOT}__md .hljs-string { color: #a6e3a1; }
.${ROOT}__md .hljs-number { color: #fab387; }
.${ROOT}__md .hljs-title,
.${ROOT}__md .hljs-function { color: #89b4fa; }
.${ROOT}__md .hljs-comment { color: #6c7086; font-style: italic; }
.${ROOT}__md .hljs-built_in,
.${ROOT}__md .hljs-type { color: #f9e2af; }
.${ROOT}__md .hljs-attr,
.${ROOT}__md .hljs-attribute { color: #89dceb; }
.${ROOT}__md .hljs-meta { color: #94e2d5; }
.${ROOT}__composer {
  border-top: 1px solid var(--chat-panel-border);
  padding: 10px;
  background: #fafafa;
}
.${ROOT}__composerRow { display: flex; gap: 8px; align-items: flex-end; }
.${ROOT}__input {
  flex: 1;
  resize: none;
  border: 1px solid var(--chat-panel-border);
  border-radius: 10px;
  padding: 10px;
  font: inherit;
  background: #fff;
}
.${ROOT}__send {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--chat-fab-bg);
  color: var(--chat-fab-fg);
  font-weight: 600;
}
.${ROOT}__send:disabled { opacity: 0.45; cursor: not-allowed; }
.${ROOT}__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.${ROOT}__quickBtn {
  border: 1px solid var(--chat-panel-border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
`;

function injectDefaultStylesOnce() {
  if (typeof document === "undefined") return;
  if (document.getElementById(DEFAULT_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = DEFAULT_STYLE_ID;
  el.textContent = defaultCss;
  document.head.appendChild(el);
}

/** Optional layout/styling for the built-in message list + composer (ignored when you fully replace those via render props). */
export type SunnyChatUi = {
  /** Applied to the outer `.sunny-chat` wrapper (e.g. CSS variables). */
  rootStyle?: CSSProperties;
  messages?: MessageListUi;
  composer?: ChatComposerUi;
};

export type SunnyChatMessageListContext = {
  /** True while waiting on the assistant stream for the latest reply. */
  loading: boolean;
};

export type SunnyChatProps = UseChatSessionConfig & {
  title?: string;
  launcherLabel?: string;
  composerPlaceholder?: string;
  className?: string;
  /** Inject default FAB + panel chrome. Default true. */
  defaultChrome?: boolean;
  /** Class names, labels, and small render hooks for the default message list + composer. */
  ui?: SunnyChatUi;
  renderHeader?: (ctx: {
    title: string;
    onClose: () => void;
  }) => ReactNode;
  renderLoading?: () => ReactNode;
  renderAssistantContent?: (text: string) => ReactNode;
  /** User (sent) bubble body; default is plain text. */
  renderUserContent?: (text: string) => ReactNode;
  renderMessageList?: (
    messages: ChatMessage[],
    ctx: SunnyChatMessageListContext,
  ) => ReactNode;
  renderComposer?: (ctx: {
    value: string;
    setValue: (v: string) => void;
    send: () => void;
    /** Sends `text` without reading the controlled input (for uncontrolled UIs such as Vercel AI Elements `PromptInput`). */
    sendText: (text: string) => void;
    loading: boolean;
    quickSlot: ReactNode;
    composerPlaceholder?: string;
  }) => ReactNode;
};

export function SunnyChat(props: SunnyChatProps) {
  const {
    title = "Chat",
    launcherLabel = "Chat",
    composerPlaceholder,
    className,
    defaultChrome = true,
    ui,
    renderHeader,
    renderLoading,
    renderAssistantContent,
    renderUserContent,
    renderMessageList,
    renderComposer,
    ...sessionCfg
  } = props;

  const chat = useChatSession(sessionCfg);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    if (props.defaultChrome !== false) injectDefaultStylesOnce();
  }, [props.defaultChrome]);

  useEffect(() => {
    if (renderMessageList) return;
    const el = scrollRef.current;
    if (!el) return;
    const count = chat.messages.length;
    if (count === prevMessageCountRef.current) return;
    prevMessageCountRef.current = count;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isOpen, renderMessageList]);

  const quickSlot =
    chat.showQuickReplies && chat.quickQuestions.length > 0 ? (
      <div className={`${ROOT}__quick`}>
        {chat.quickQuestions.map((q) => (
          <button
            type="button"
            key={q}
            className={`${ROOT}__quickBtn`}
            onClick={() => chat.onQuickQuestion(q)}
          >
            {q}
          </button>
        ))}
      </div>
    ) : null;

  const panelBody = (
    <>
      <div ref={scrollRef} className={`${ROOT}__body`}>
        {chat.isLoadingHistory && !chat.historyInitialized ? (
          renderLoading?.() ?? (
            <div className={`${ROOT}__skeleton`}>Loading conversation…</div>
          )
        ) : renderMessageList ? (
          renderMessageList(chat.messages, { loading: chat.loading })
        ) : (
          <MessageList
            messages={chat.messages}
            loading={chat.loading}
            renderAssistantContent={renderAssistantContent}
            renderUserContent={renderUserContent}
            ui={ui?.messages}
          />
        )}
      </div>
      {renderComposer ? (
        renderComposer({
          value: chat.input,
          setValue: chat.setInput,
          send: () => void chat.sendMessage(),
          sendText: (text) => void chat.sendMessage(text),
          loading: chat.loading,
          quickSlot,
          composerPlaceholder,
        })
      ) : (
        <ChatComposer
          value={chat.input}
          onChange={chat.setInput}
          onSend={() => void chat.sendMessage()}
          disabled={chat.loading}
          placeholder={composerPlaceholder}
          slotBefore={quickSlot}
          ui={ui?.composer}
        />
      )}
    </>
  );

  if (!defaultChrome) {
    return (
      <div
        className={[ROOT, className].filter(Boolean).join(" ")}
        style={ui?.rootStyle}
      >
        {panelBody}
      </div>
    );
  }

  return (
    <div
      className={[ROOT, className].filter(Boolean).join(" ")}
      style={ui?.rootStyle}
    >
      {!chat.isOpen && (
        <button
          type="button"
          className={`${ROOT}__fab`}
          onClick={() => chat.setIsOpen(true)}
        >
          {launcherLabel}
        </button>
      )}
      {chat.isOpen && (
        <>
          <button
            type="button"
            className={`${ROOT}__backdrop`}
            aria-label="Close chat"
            onClick={() => chat.setIsOpen(false)}
          />
          <section className={`${ROOT}__panel`} aria-label={title}>
            {renderHeader ? (
              renderHeader({
                title,
                onClose: () => chat.setIsOpen(false),
              })
            ) : (
              <header className={`${ROOT}__header`}>
                <span>{title}</span>
                <button
                  type="button"
                  className={`${ROOT}__close`}
                  onClick={() => chat.setIsOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
            )}
            {panelBody}
          </section>
        </>
      )}
    </div>
  );
}
