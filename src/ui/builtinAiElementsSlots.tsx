import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import type { ChatSource, ChatToolInvocation } from "../core/types.js";
import { ChatPendingReply } from "./ChatPendingReply.js";
import { useConversationScrollState } from "./conversationScroll.js";
import { useMarkedHtml } from "./markdown.js";
import {
  mergeSunnyChatAiElementsOptions,
  SunnyChatAiElements,
  type SunnyChatAiElementsProps,
  type SunnyChatAiElementsRenderersOptions,
  type SunnyChatAiElementsSlots,
} from "./sunnyChatAiElements.js";

const ROOT = "sunny-chat-ael";

const STYLE_ID = "sunny-chat-builtin-ai-elements-css";

const builtinCss = `
.${ROOT}__conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}
.${ROOT}__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 4px 12px;
  background: var(--chat-messages-bg, transparent);
}
.${ROOT}__scrollBtn {
  position: absolute;
  bottom: 8px;
  right: 12px;
  z-index: 2;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--chat-panel-border, #e4e4e7);
  background: var(--chat-panel-bg, #fff);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: #3f3f46;
}
.${ROOT}__scrollBtn:hover {
  background: #fafafa;
}
.${ROOT}__msgRow {
  display: flex;
  margin-bottom: 10px;
}
.${ROOT}__msgRow--user {
  justify-content: flex-end;
}
.${ROOT}__msgRow--assistant {
  justify-content: flex-start;
}
.${ROOT}__bubble {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 12px;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.45;
}
.${ROOT}__msgRow--user .${ROOT}__bubble {
  background: var(--chat-user-bg, #2563eb);
  color: var(--chat-user-fg, #fff);
}
.${ROOT}__msgRow--assistant .${ROOT}__bubble {
  background: var(--chat-assistant-bg, #f4f4f5);
  color: var(--chat-assistant-fg, #18181b);
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
.${ROOT}__sources {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--chat-panel-border, #e4e4e7);
  background: #fafafa;
  font-size: 12px;
  line-height: 1.45;
  color: #3f3f46;
}
.${ROOT}__sourcesTitle { font-weight: 600; margin-bottom: 6px; }
.${ROOT}__sources ul { margin: 0; padding-left: 18px; }
.${ROOT}__sources a { color: #2563eb; }
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
.${ROOT}__form {
  border-top: 1px solid var(--chat-panel-border, #e4e4e7);
  padding: 10px;
  background: var(--chat-composer-bg, #fafafa);
}
.${ROOT}__suggestions {
  margin-bottom: 10px;
  padding: 0 2px;
}
.${ROOT}__suggestions .sunny-chat__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0;
}
.${ROOT}__suggestions .sunny-chat__quickBtn {
  border: 1px solid var(--chat-panel-border, #e4e4e7);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  color: #3f3f46;
}
.${ROOT}__suggestions .sunny-chat__quickBtn:hover {
  background: #f4f4f5;
}
.${ROOT}__body {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.${ROOT}__textarea {
  width: 100%;
  min-height: 44px;
  max-height: 160px;
  resize: vertical;
  border: 1px solid var(--chat-panel-border, #e4e4e7);
  border-radius: 10px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  background: var(--chat-input-bg, #fff);
  box-sizing: border-box;
}
.${ROOT}__textarea:focus {
  outline: 2px solid rgba(37, 99, 235, 0.35);
  outline-offset: 0;
}
.${ROOT}__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.${ROOT}__submit {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--chat-fab-bg, #2563eb);
  color: var(--chat-fab-fg, #fff);
  font-weight: 600;
  font-size: 14px;
  min-width: 44px;
}
.${ROOT}__submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.${ROOT}__submitDot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: ${ROOT}-pulse 0.9s ease-in-out infinite alternate;
}
@keyframes ${ROOT}-pulse {
  from { opacity: 0.35; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
`;

function injectBuiltinAiElementsStylesOnce() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = builtinCss;
  document.head.appendChild(el);
}

/** Maps to builtin CSS variables (`--chat-user-bg`, `--chat-messages-bg`, …). */
export type SunnyChatBuiltinThemeVars = {
  userBubbleBackground?: string;
  userBubbleForeground?: string;
  assistantBubbleBackground?: string;
  assistantBubbleForeground?: string;
  messagesAreaBackground?: string;
  composerBackground?: string;
  inputBackground?: string;
  panelBorder?: string;
  sendButtonBackground?: string;
  sendButtonForeground?: string;
};

export type SunnyChatBuiltinAiElementsUi = SunnyChatAiElementsRenderersOptions & {
  /** Merged onto the outer `SunnyChat` `className` (e.g. Tailwind scope). */
  rootClassName?: string;
  /** Merged into `ui.rootStyle` after {@link SunnyChatBuiltinThemeVars}. */
  rootStyle?: CSSProperties;
  themeVars?: SunnyChatBuiltinThemeVars;
};

function sunnyChatBuiltinThemeVarsToStyle(
  vars?: SunnyChatBuiltinThemeVars,
): CSSProperties | undefined {
  if (!vars) return undefined;
  const s: Record<string, string> = {};
  if (vars.userBubbleBackground) s["--chat-user-bg"] = vars.userBubbleBackground;
  if (vars.userBubbleForeground) s["--chat-user-fg"] = vars.userBubbleForeground;
  if (vars.assistantBubbleBackground) {
    s["--chat-assistant-bg"] = vars.assistantBubbleBackground;
  }
  if (vars.assistantBubbleForeground) {
    s["--chat-assistant-fg"] = vars.assistantBubbleForeground;
  }
  if (vars.messagesAreaBackground) {
    s["--chat-messages-bg"] = vars.messagesAreaBackground;
  }
  if (vars.composerBackground) s["--chat-composer-bg"] = vars.composerBackground;
  if (vars.inputBackground) s["--chat-input-bg"] = vars.inputBackground;
  if (vars.panelBorder) s["--chat-panel-border"] = vars.panelBorder;
  if (vars.sendButtonBackground) s["--chat-fab-bg"] = vars.sendButtonBackground;
  if (vars.sendButtonForeground) s["--chat-fab-fg"] = vars.sendButtonForeground;
  return s as CSSProperties;
}

function sliceBuiltinRendererOptions(
  ui?: SunnyChatBuiltinAiElementsUi,
): SunnyChatAiElementsRenderersOptions | undefined {
  if (!ui) return undefined;
  const { rootClassName: _rc, rootStyle: _rs, themeVars: _tv, ...rest } = ui;
  return rest;
}

type ScrollCtx = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  atBottom: boolean;
  checkBottom: () => void;
  scrollToBottom: () => void;
  stickToBottomRef: React.MutableRefObject<boolean>;
};

const ScrollContext = createContext<ScrollCtx | null>(null);

function BuiltinConversation({
  className,
  children,
  role,
}: {
  className?: string;
  children?: ReactNode;
  role?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const stickToBottomRef = useRef(false);

  const checkBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = gap < 56;
    stickToBottomRef.current = near;
    setAtBottom(near);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottomRef.current = true;
    setAtBottom(true);
  }, []);

  const value = useMemo(
    () => ({
      scrollRef,
      atBottom,
      checkBottom,
      scrollToBottom,
      stickToBottomRef,
    }),
    [atBottom, checkBottom, scrollToBottom],
  );

  return (
    <ScrollContext.Provider value={value}>
      <section
        className={[ROOT + "__conversation", className].filter(Boolean).join(" ")}
        role={role}
      >
        {children}
      </section>
    </ScrollContext.Provider>
  );
}

function BuiltinConversationContent({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error("sunny-chat: ConversationContent must be inside Conversation");
  }
  const { scrollRef, checkBottom, stickToBottomRef } = ctx;
  const { messageCount, streaming } = useConversationScrollState();
  const prevMessageCountRef = useRef(messageCount);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const countChanged = messageCount !== prevMessageCountRef.current;
    prevMessageCountRef.current = messageCount;

    if (countChanged) {
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = false;
    } else if (!streaming && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    checkBottom();
  }, [
    children,
    messageCount,
    streaming,
    scrollRef,
    checkBottom,
    stickToBottomRef,
  ]);

  return (
    <div
      ref={scrollRef}
      className={[ROOT + "__scroll", className].filter(Boolean).join(" ")}
      onScroll={checkBottom}
    >
      {children}
    </div>
  );
}

function BuiltinConversationScrollButton({ className }: { className?: string }) {
  const ctx = useContext(ScrollContext);
  if (!ctx || ctx.atBottom) return null;
  return (
    <button
      type="button"
      className={[ROOT + "__scrollBtn", className].filter(Boolean).join(" ")}
      aria-label="Scroll to latest message"
      onClick={ctx.scrollToBottom}
    >
      ↓
    </button>
  );
}

function BuiltinMessage({
  from,
  className,
  children,
}: {
  from: "user" | "assistant";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        ROOT + "__msgRow",
        from === "user" ? ROOT + "__msgRow--user" : ROOT + "__msgRow--assistant",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-from={from}
    >
      {children}
    </div>
  );
}

function BuiltinMessageContent({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={[ROOT + "__bubble", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function BuiltinMessageResponse({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const text = typeof children === "string" ? children : "";
  const html = useMarkedHtml(text);
  return (
    <div
      className={[ROOT + "__md", className].filter(Boolean).join(" ")}
      // eslint-disable-next-line react/no-danger -- mirrors default MessageList; host can swap slots
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function BuiltinMessageSources({ sources }: { sources: ChatSource[] }) {
  return (
    <div className={ROOT + "__sources"}>
      <div className={ROOT + "__sourcesTitle"}>Sources</div>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuiltinToolInvocation({
  invocation: inv,
}: {
  invocation: ChatToolInvocation;
}) {
  const stateClass =
    inv.state === "pending"
      ? ROOT + "__toolState--pending"
      : inv.state === "error"
        ? ROOT + "__toolState--error"
        : ROOT + "__toolState--complete";
  return (
    <div className={ROOT + "__tool"}>
      <div className={ROOT + "__toolHead"}>
        <span className={[ROOT + "__toolState", stateClass].join(" ")}>
          {inv.state}
        </span>
        <span>{inv.name}</span>
      </div>
      {inv.result ? (
        <pre className={ROOT + "__toolPre"}>{inv.result}</pre>
      ) : null}
    </div>
  );
}

function BuiltinLoader() {
  return <ChatPendingReply className={ROOT + "__pending"} />;
}

function BuiltinPromptSuggestions({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={[ROOT + "__suggestions", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

function BuiltinPromptInput({
  className,
  onSubmit,
  children,
}: {
  className?: string;
  onSubmit: (
    message: { text: string },
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
  children?: ReactNode;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const raw = fd.get("message");
    const text = typeof raw === "string" ? raw : "";
    const result = onSubmit({ text }, event);
    void Promise.resolve(result).finally(() => {
      form.reset();
    });
  };

  return (
    <form
      className={[ROOT + "__form", className].filter(Boolean).join(" ")}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}

function BuiltinPromptInputBody({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={[ROOT + "__body", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function BuiltinPromptInputTextarea({
  className,
  placeholder,
  disabled,
}: {
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      name="message"
      className={[ROOT + "__textarea", className].filter(Boolean).join(" ")}
      placeholder={placeholder}
      disabled={disabled}
      rows={2}
      autoComplete="off"
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        const form = e.currentTarget.form;
        const submit = form?.querySelector(
          'button[type="submit"]',
        ) as HTMLButtonElement | null;
        if (submit?.disabled) return;
        form?.requestSubmit();
      }}
    />
  );
}

function BuiltinPromptInputFooter({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={[ROOT + "__footer", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function BuiltinPromptInputSubmit({
  className,
  disabled,
  status,
  children,
}: {
  className?: string;
  disabled?: boolean;
  status?: "submitted" | "streaming" | "error";
  children?: ReactNode;
}) {
  const busy = status === "submitted" || status === "streaming";
  return (
    <button
      type="submit"
      className={[ROOT + "__submit", className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <span className={ROOT + "__submitDot"} aria-hidden /> : children ?? "Send"}
    </button>
  );
}

/** Conversation / message / prompt primitives matching [Vercel AI Elements](https://elements.ai-sdk.dev) slot shapes — no shadcn or Tailwind required. */
export const builtinAiElementsSlots: SunnyChatAiElementsSlots = {
  Conversation: BuiltinConversation,
  ConversationContent: BuiltinConversationContent,
  Message: BuiltinMessage,
  MessageContent: BuiltinMessageContent,
  MessageResponse: BuiltinMessageResponse,
  MessageSources: BuiltinMessageSources,
  ToolInvocation: BuiltinToolInvocation,
  Loader: BuiltinLoader,
  PromptInput: BuiltinPromptInput,
  PromptSuggestions: BuiltinPromptSuggestions,
  PromptInputBody: BuiltinPromptInputBody,
  PromptInputTextarea: BuiltinPromptInputTextarea,
  PromptInputFooter: BuiltinPromptInputFooter,
  PromptInputSubmit: BuiltinPromptInputSubmit,
  ConversationScrollButton: BuiltinConversationScrollButton,
};

export type SunnyChatBuiltinAiElementsProps = Omit<
  SunnyChatAiElementsProps,
  "aiElements"
> & {
  /**
   * Builtin-only styling: CSS variables, root classes, and the same option keys as
   * {@link SunnyChatAiElementsRenderersOptions} (merged with `aiElementsOptions`).
   */
  builtinUi?: SunnyChatBuiltinAiElementsUi;
};

/**
 * {@link SunnyChatAiElements} with built-in AI Elements–compatible UI (conversation, markdown bubbles, prompt input).
 * For official registry components (Tailwind + shadcn), install AI Elements in your app and use {@link SunnyChatAiElements} with `aiElements`.
 */
export function SunnyChatBuiltinAiElements({
  builtinUi,
  aiElementsOptions,
  className,
  ui,
  ...props
}: SunnyChatBuiltinAiElementsProps) {
  injectBuiltinAiElementsStylesOnce();
  const fromTheme = sunnyChatBuiltinThemeVarsToStyle(builtinUi?.themeVars);
  const mergedOptions = mergeSunnyChatAiElementsOptions(
    aiElementsOptions,
    sliceBuiltinRendererOptions(builtinUi),
  );
  const mergedUi =
    fromTheme || builtinUi?.rootStyle || ui
      ? {
          ...ui,
          rootStyle: { ...fromTheme, ...builtinUi?.rootStyle, ...ui?.rootStyle },
        }
      : ui;
  const mergedClassName =
    [className, builtinUi?.rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <SunnyChatAiElements
      {...props}
      className={mergedClassName}
      ui={mergedUi}
      aiElements={builtinAiElementsSlots}
      aiElementsOptions={mergedOptions}
    />
  );
}
