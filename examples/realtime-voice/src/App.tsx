import { useCallback, useState } from "react";
import {
  ChatComposer,
  MessageList,
  useRealtimeChatSession,
  type RealtimeConnectionState,
} from "sunny-chat";

const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:7777";
const DEFAULT_USER_ID = "demo-user-123";
const INITIAL_INSTRUCTIONS =
  "Please greet the user warmly by name if available, introduce yourself as their Generac Solar Advisor, and ask how you can help with their solar proposal today.";

function statusLabel(state: RealtimeConnectionState) {
  switch (state) {
    case "connecting":
      return "Connecting";
    case "listening":
      return "Listening";
    case "speaking":
      return "Speaking";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

export function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE);
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [input, setInput] = useState("");

  const chat = useRealtimeChatSession({
    baseUrl,
    getUserId: () => userId.trim() || null,
    initialInstructions: INITIAL_INSTRUCTIONS,
  });

  const onSend = useCallback(() => {
    if (!input.trim()) return;
    const sent = chat.sendText(input);
    if (sent) {
      setInput("");
    }
  }, [chat, input]);

  const canSend = chat.isConnected;
  const micLabel = chat.isConnected ? "Disconnect mic" : "Connect mic";

  return (
    <div className="voice-example">
      <div className="voice-example__shell">
        <header className="voice-example__header">
          <div>
            <p className="voice-example__eyebrow">SunnyChat</p>
            <h1>Realtime Voice Chat</h1>
            <p className="voice-example__subhead">
              Chat bubbles plus a live mic session, powered by the existing voice agent backend.
            </p>
          </div>
          <div className={`voice-example__status voice-example__status--${chat.connectionState}`}>
            <span className="voice-example__statusDot" />
            {statusLabel(chat.connectionState)}
          </div>
        </header>

        <section className="voice-example__config">
          <label>
            <span>API Base URL</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
          <label>
            <span>User ID</span>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <button
            type="button"
            className={`voice-example__mic ${chat.isConnected ? "is-live" : ""}`}
            onClick={() => {
              if (chat.isConnected) chat.disconnect();
              else void chat.connect();
            }}
          >
            {micLabel}
          </button>
        </section>

        {chat.error ? <p className="voice-example__error">{chat.error}</p> : null}

        <main className="voice-example__card">
          <div className="voice-example__transcript">
            <MessageList
              messages={chat.messages}
              loading={chat.isResponding}
              ui={{
                className: "voice-example__messages",
                userBubbleClassName: "voice-example__bubble voice-example__bubble--user",
                assistantBubbleClassName: "voice-example__bubble voice-example__bubble--assistant",
              }}
            />
          </div>

          <div className="voice-example__composerWrap">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={onSend}
              disabled={!canSend}
              placeholder={chat.isConnected ? "Type into the live voice session…" : "Connect the mic session first…"}
              ui={{
                formClassName: "voice-example__composer",
                inputClassName: "voice-example__input",
                sendButtonClassName: "voice-example__send",
                sendButtonLabel: "Send",
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
