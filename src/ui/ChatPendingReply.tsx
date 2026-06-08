import { useLayoutEffect } from "react";

const STYLE_ID = "sunny-chat-pending-reply-css";

const css = `
.sunny-chat-pending {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  min-height: 22px;
}
.sunny-chat-pending__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #71717a;
  animation: sunny-chat-pending-bounce 1s ease-in-out infinite;
}
.sunny-chat-pending__dot:nth-child(2) {
  animation-delay: 0.15s;
}
.sunny-chat-pending__dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes sunny-chat-pending-bounce {
  0%, 80%, 100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
`;

function injectPendingStylesOnce() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Default “typing” indicator while the assistant stream has not produced visible text yet. */
export function ChatPendingReply({ className }: { className?: string }) {
  useLayoutEffect(() => {
    injectPendingStylesOnce();
  }, []);

  return (
    <div
      className={["sunny-chat-pending", className].filter(Boolean).join(" ")}
      aria-live="polite"
      aria-busy
    >
      <span className="sunny-chat-pending__dot" aria-hidden />
      <span className="sunny-chat-pending__dot" aria-hidden />
      <span className="sunny-chat-pending__dot" aria-hidden />
    </div>
  );
}
