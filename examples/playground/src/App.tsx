import { SunnyChat } from "sunny-chat";

const baseUrl = (import.meta.env.VITE_API_BASE ?? "").trim();

export default function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 560 }}>
      <h1 style={{ marginTop: 0 }}>sunny-chat playground</h1>
      <p style={{ color: "#52525b", lineHeight: 1.5 }}>
        Add <code>examples/playground/.env</code> with{" "}
        <code>VITE_API_BASE=https://your-api-host</code> (your Sunny / v3 API root, same
        idea as <code>REACT_APP_V3_BASE_URL</code>). Restart <code>npm run dev</code> after
        changing env. Then use the chat button — the widget calls{" "}
        <code>POST …/chat</code> and loads <code>GET …/chat/history/…</code>.
      </p>
      {!baseUrl && (
        <p
          style={{
            color: "#b45309",
            padding: "12px 14px",
            background: "#fffbeb",
            borderRadius: 8,
            border: "1px solid #fcd34d",
          }}
        >
          Set <code>VITE_API_BASE</code> to enable the widget (see{" "}
          <code>.env.example</code> in this folder).
        </p>
      )}
      {baseUrl ? (
        <SunnyChat
          baseUrl={baseUrl}
          teamName="ritz-team"
          sessionIdSuffix="_playground"
          getUserId={() => "playground-user"}
          greetingAssistantText="Hi — playground is wired to your API. Send a message to test streaming."
          quickQuestions={["What can you help with?", "Summarize my options."]}
          title="Playground chat"
          launcherLabel="Try chat"
        />
      ) : null}
    </div>
  );
}
