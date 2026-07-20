import { useCallback, useEffect, useState } from "react";
import { SunnyChat, chatPathFor } from "sunny-chat";
import type { ChatAnalyticsEvent, ChatSurface } from "sunny-chat";
import "./styles.css";

type LogEntry = {
  id: number;
  time: string;
  label: string;
};

type ConnectionConfig = {
  baseUrl: string;
  apiKey: string;
  teamName: string;
  sessionIdSuffix: string;
  userId: string;
  chatSurface: ChatSurface;
  greetingAssistantText: string;
  quickQuestionsText: string;
};

const STORAGE_KEY = "sunny-chat-playground-config";

const SURFACE_OPTIONS: {
  value: ChatSurface;
  label: string;
  hint: string;
}[] = [
  {
    value: "preProposal",
    label: "Pre-proposal",
    hint: "/agents/pre-proposal/chat",
  },
  {
    value: "postProposal",
    label: "Post-proposal",
    hint: "/agents/post-proposal/chat",
  },
  {
    value: "default",
    label: "Default",
    hint: "/agents/chat",
  },
];

const DEFAULT_DRAFT: ConnectionConfig = {
  baseUrl: "",
  apiKey: "",
  teamName: "",
  sessionIdSuffix: "_pre_proposal",
  userId: "",
  chatSurface: "preProposal",
  greetingAssistantText: "Hi! How can I help?",
  quickQuestionsText: "What are my next steps?\nHow does billing work?",
};

let logId = 0;

function formatEvent(event: ChatAnalyticsEvent): string {
  switch (event.type) {
    case "fab_open":
      return "Panel opened";
    case "panel_close":
      return "Panel closed";
    case "message_send":
      return event.fromQuickQuestion
        ? "Message sent (quick reply)"
        : "Message sent";
    case "quick_question_click":
      return `Quick question: "${event.question}"`;
    default:
      return JSON.stringify(event);
  }
}

function loadDraft(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
    const chatSurface =
      parsed.chatSurface === "preProposal" ||
      parsed.chatSurface === "postProposal" ||
      parsed.chatSurface === "default"
        ? parsed.chatSurface
        : DEFAULT_DRAFT.chatSurface;
    return { ...DEFAULT_DRAFT, ...parsed, chatSurface };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function parseQuickQuestions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function App() {
  const [draft, setDraft] = useState<ConnectionConfig>(loadDraft);
  const [applied, setApplied] = useState<ConnectionConfig | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const pushLog = useCallback((label: string) => {
    setLogs((prev) => [
      { id: ++logId, time: new Date().toLocaleTimeString(), label },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const updateField = <K extends keyof ConnectionConfig>(
    key: K,
    value: ConnectionConfig[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
  };

  const setChatSurface = (surface: ChatSurface) => {
    setDraft((prev) => {
      const next = { ...prev, chatSurface: surface };
      const autoSuffixes = [
        "_playground",
        "_pre_proposal",
        "_post_proposal",
        "_default",
      ];
      if (autoSuffixes.includes(prev.sessionIdSuffix)) {
        if (surface === "preProposal") next.sessionIdSuffix = "_pre_proposal";
        else if (surface === "postProposal")
          next.sessionIdSuffix = "_post_proposal";
        else next.sessionIdSuffix = "_playground";
      }
      return next;
    });
    setFormError(null);
  };

  const connect = () => {
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    const teamName = draft.teamName.trim();
    const sessionIdSuffix = draft.sessionIdSuffix.trim();

    if (!baseUrl) {
      setFormError("Base URL is required.");
      return;
    }
    if (!teamName) {
      setFormError("Team name is required.");
      return;
    }
    if (!sessionIdSuffix) {
      setFormError("Session ID suffix is required.");
      return;
    }

    const next: ConnectionConfig = {
      ...draft,
      baseUrl,
      teamName,
      sessionIdSuffix,
      apiKey: draft.apiKey.trim(),
      userId: draft.userId.trim(),
      greetingAssistantText:
        draft.greetingAssistantText.trim() ||
        DEFAULT_DRAFT.greetingAssistantText,
    };

    const path = chatPathFor(next.chatSurface);
    setApplied(next);
    setChatKey((k) => k + 1);
    setFormError(null);
    pushLog(`Connected → ${baseUrl}${path}`);
  };

  const disconnect = () => {
    setApplied(null);
    setChatKey((k) => k + 1);
    pushLog("Disconnected");
  };

  const resetChat = () => {
    if (!applied) return;
    setChatKey((k) => k + 1);
    pushLog("Chat reset");
  };

  const quickQuestions = applied
    ? parseQuickQuestions(applied.quickQuestionsText)
    : [];

  const livePath = applied ? chatPathFor(applied.chatSurface) : null;

  return (
    <div className="playground">
      <aside className="playground__sidebar">
        <header className="playground__sidebarHeader">
          <h1>SunnyChat Playground</h1>
          <p>Enter backend details and chat against a real SSE API.</p>
        </header>

        <section className="playground__section">
          <h2>Connection</h2>
          <div className="playground__form">
            <label className="playground__field">
              <span>Base URL</span>
              <input
                type="url"
                placeholder="https://api.example.com"
                value={draft.baseUrl}
                onChange={(e) => updateField("baseUrl", e.target.value)}
                autoComplete="off"
              />
              <small>Origin only — chat path depends on surface below</small>
            </label>

            <fieldset className="playground__fieldset">
              <legend>Chat surface</legend>
              <div className="playground__radios">
                {SURFACE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="playground__radio">
                    <input
                      type="radio"
                      name="chatSurface"
                      checked={draft.chatSurface === opt.value}
                      onChange={() => setChatSurface(opt.value)}
                    />
                    <span>
                      <strong>{opt.label}</strong>
                      <small>{opt.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="playground__field">
              <span>API key</span>
              <input
                type="password"
                placeholder="Optional Bearer token"
                value={draft.apiKey}
                onChange={(e) => updateField("apiKey", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="playground__field">
              <span>Team name</span>
              <input
                type="text"
                placeholder="generac-team"
                value={draft.teamName}
                onChange={(e) => updateField("teamName", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="playground__field">
              <span>Session ID suffix</span>
              <input
                type="text"
                placeholder="_pre_proposal"
                value={draft.sessionIdSuffix}
                onChange={(e) => updateField("sessionIdSuffix", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="playground__field">
              <span>User ID</span>
              <input
                type="text"
                placeholder="Optional — anonymous if empty"
                value={draft.userId}
                onChange={(e) => updateField("userId", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="playground__field">
              <span>Greeting</span>
              <textarea
                rows={2}
                value={draft.greetingAssistantText}
                onChange={(e) =>
                  updateField("greetingAssistantText", e.target.value)
                }
              />
            </label>

            <label className="playground__field">
              <span>Quick questions</span>
              <textarea
                rows={3}
                placeholder="One per line"
                value={draft.quickQuestionsText}
                onChange={(e) =>
                  updateField("quickQuestionsText", e.target.value)
                }
              />
              <small>One question per line</small>
            </label>

            {formError ? (
              <p className="playground__error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="playground__controls">
              <button type="button" onClick={connect}>
                {applied ? "Reconnect" : "Connect"}
              </button>
              {applied ? (
                <>
                  <button
                    type="button"
                    className="playground__controlsBtn--secondary"
                    onClick={resetChat}
                  >
                    Reset chat
                  </button>
                  <button
                    type="button"
                    className="playground__controlsBtn--secondary"
                    onClick={disconnect}
                  >
                    Disconnect
                  </button>
                </>
              ) : null}
            </div>

            {applied && livePath ? (
              <p className="playground__status playground__status--ok">
                Live →{" "}
                <code>
                  {applied.baseUrl}
                  {livePath}
                </code>
              </p>
            ) : (
              <p className="playground__status">
                Not connected — fill the form and click Connect.
              </p>
            )}
          </div>
        </section>

        <section className="playground__section playground__section--logs">
          <h2>Analytics log</h2>
          {logs.length === 0 ? (
            <p className="playground__empty">Events appear here as you chat.</p>
          ) : (
            <ul className="playground__logs">
              {logs.map((entry) => (
                <li key={entry.id}>
                  <time>{entry.time}</time> {entry.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <main className="playground__main">
        <div className="playground__chatFrame">
          {applied ? (
            <SunnyChat
              key={chatKey}
              initialOpen
              title="Live Assistant"
              launcherLabel="Open chat"
              composerPlaceholder="Ask the live backend…"
              baseUrl={applied.baseUrl}
              apiKey={applied.apiKey || undefined}
              chatSurface={applied.chatSurface}
              teamName={applied.teamName}
              sessionIdSuffix={applied.sessionIdSuffix}
              getUserId={() => applied.userId || null}
              greetingAssistantText={applied.greetingAssistantText}
              quickQuestions={quickQuestions}
              quickReplyBehavior="always"
              onAnalytics={(event) => {
                pushLog(formatEvent(event));
              }}
              ui={{
                rootStyle: {
                  ["--chat-fab-bg" as string]: "#0f766e",
                  ["--chat-user-bg" as string]: "#0f766e",
                },
              }}
            />
          ) : (
            <div className="playground__placeholder">
              <h2>Connect to start</h2>
              <p>
                Choose <strong>pre-proposal</strong> or{" "}
                <strong>post-proposal</strong>, then connect. Chat POSTs to the
                matching agent route; history stays on{" "}
                <code>/agents/chat/history/:userId</code>.
              </p>
            </div>
          )}
        </div>
        <p className="playground__hint">
          Values are saved in <code>localStorage</code>. If the stream fails,
          check CORS on the API and DevTools → Network for the surface path.
        </p>
      </main>
    </div>
  );
}
