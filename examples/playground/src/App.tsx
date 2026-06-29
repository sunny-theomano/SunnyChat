import { useCallback, useMemo, useRef, useState } from "react";
import { SunnyChat } from "sunny-chat";
import type { ChatAnalyticsEvent } from "sunny-chat";
import { MOCK_SCENARIOS } from "./mockResponses";
import { MOCK_BASE, createMockFetch } from "./mockFetch";
import "./styles.css";

type LogEntry = {
  id: number;
  time: string;
  label: string;
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

export function App() {
  const [chatKey, setChatKey] = useState(0);
  const [simulateError, setSimulateError] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const simulateErrorRef = useRef(false);

  simulateErrorRef.current = simulateError;

  const fetchImpl = useMemo(
    () =>
      createMockFetch({
        shouldSimulateError: () => simulateErrorRef.current,
      }),
    [],
  );

  const pushLog = useCallback((label: string) => {
    setLogs((prev) => [
      { id: ++logId, time: new Date().toLocaleTimeString(), label },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const resetChat = () => {
    setSimulateError(false);
    setChatKey((k) => k + 1);
    pushLog("Chat reset");
  };

  const quickQuestions = MOCK_SCENARIOS.map((s) => s.question);

  return (
    <div className="playground">
      <aside className="playground__sidebar">
        <header className="playground__sidebarHeader">
          <h1>SunnyChat Playground</h1>
          <p>Mock backend — no real API needed.</p>
        </header>

        <section className="playground__section">
          <h2>Mock scenarios</h2>
          <ul className="playground__scenarios">
            {MOCK_SCENARIOS.map((scenario) => (
              <li key={scenario.id} className="playground__scenario">
                <strong>{scenario.question}</strong>
                <p>{scenario.response.slice(0, 90)}…</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="playground__section">
          <h2>Controls</h2>
          <div className="playground__controls">
            <button type="button" onClick={resetChat}>
              Reset chat
            </button>
            <label className="playground__checkbox">
              <input
                type="checkbox"
                checked={simulateError}
                onChange={(e) => {
                  setSimulateError(e.target.checked);
                  pushLog(
                    e.target.checked
                      ? "Next message will fail"
                      : "Error simulation off",
                  );
                }}
              />
              Fail next message
            </label>
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
          <SunnyChat
            key={chatKey}
            initialOpen
            title="Mock Assistant"
            launcherLabel="Open chat"
            composerPlaceholder="Ask a mock question…"
            baseUrl={MOCK_BASE}
            teamName="playground-team"
            sessionIdSuffix="_playground"
            getUserId={() => "playground-user"}
            greetingAssistantText="Hi! This is a **mock chat** — pick a quick reply or type one of the questions from the sidebar."
            quickQuestions={quickQuestions}
            quickReplyBehavior="always"
            fetchImpl={fetchImpl}
            onAnalytics={(event) => {
              pushLog(formatEvent(event));
              if (event.type === "message_send" && simulateErrorRef.current) {
                setSimulateError(false);
                pushLog("Error simulation consumed");
              }
            }}
            ui={{
              rootStyle: {
                ["--chat-fab-bg" as string]: "#0f766e",
                ["--chat-user-bg" as string]: "#0f766e",
              },
            }}
          />
        </div>
        <p className="playground__hint">
          The chat widget uses a local mock <code>fetchImpl</code> that streams
          SSE responses. Open DevTools → Network to inspect requests.
        </p>
      </main>
    </div>
  );
}
