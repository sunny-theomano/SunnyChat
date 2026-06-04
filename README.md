# sunny-chat

React chatbox library implementing the streaming chat contract described in `Businesslogic.md`: **SSE parsing, session IDs, history merge rules, abort, quick replies, analytics callbacks, and optional default UI** — so your app only supplies **configuration** (URLs, `teamName`, `sessionIdSuffix`, `getUserId`, copy).

## Install (GitHub only — no npmjs.com)

Source: [github.com/sunny-theomano/SunnyChat](https://github.com/sunny-theomano/SunnyChat).

1. In your app’s `package.json`, depend on the repo (pick **one** form):

**Shorthand (public repo)**

```json
{
  "dependencies": {
    "sunny-chat": "github:sunny-theomano/SunnyChat#main"
  }
}
```

Use `main` or another branch to match GitHub. Pin a tag or commit if you want: `github:sunny-theomano/SunnyChat#v0.1.0` or `github:sunny-theomano/SunnyChat#abc1234`.

**Full git URL (private repo + auth your machine already has)**

```json
{
  "dependencies": {
    "sunny-chat": "git+https://github.com/sunny-theomano/SunnyChat.git#main"
  }
}
```

2. Install:

```bash
npm install
```

On install, npm runs the **`prepare`** script in this package, which runs **`npm run build`** and generates `dist/`. You do **not** need to publish to the npm registry.

**Peer dependency:** `react` ≥ 18 (and `react-dom` if you use the default UI in the browser).

### Optional: publish to npm later

If you ever want `npm install sunny-chat` from the public registry, you can still publish the same repo to npm separately; the GitHub flow above does not require it.

## Zero–business-logic usage

Drop in `SunnyChat` with backend config and branding strings. No manual `fetch`, stream parsing, or history merge logic in the host app.

```tsx
import { SunnyChat } from "sunny-chat";

export function App() {
  return (
    <SunnyChat
      baseUrl={import.meta.env.VITE_API_BASE}
      teamName="generac-team"
      sessionIdSuffix="_generac_offer"
      getUserId={() => window.__USER_ID__ ?? null}
      greetingAssistantText="Hi! Ask me anything about your offer."
      quickQuestions={[
        "What are my next steps?",
        "How does billing work?",
      ]}
      onAnalytics={(event) => {
        // map to PostHog / GA — library does not hard-code analytics
        console.log(event);
      }}
    />
  );
}
```

### Required configuration

| Prop | Purpose |
|------|--------|
| `baseUrl` **or** `streamUrl` | `POST …/chat` (or full chat URL) |
| `teamName` | Backend routing (e.g. `generac-team`, `ritz-team`) |
| `sessionIdSuffix` | Thread namespace per surface (e.g. `_proposal`, `_generac_offer`) |
| `getUserId` | Stable user id; library generates anonymous id if null |
| `greetingAssistantText` | Seed when history is empty |

### Optional

- `historyUrl` — override `GET` URL (default: `${baseUrl}/chat/history/:userId`)
- `quickQuestions` — chips until first interaction (per doc)
- `sanitizeHistory` / `filterUiMessages` / `shouldSkipAutoSend` — loader / hidden-prompt flows
- `parseChunk` — extend SSE JSON handling beyond `TeamRunContent` / `TeamRunCompleted`
- `connectionErrorText` — assistant bubble text on network/HTTP failure
- `initialOpen` — open panel without FAB (e.g. embedded concierge)
- `defaultChrome={false}` — render thread + composer only; you provide shell / FAB

## Headless (`useChatSession`)

Use your own design system while keeping all transport and merge behavior:

```tsx
import { useChatSession } from "sunny-chat";

const chat = useChatSession({
  streamUrl: "https://api.example.com/chat",
  teamName: "ritz-team",
  sessionIdSuffix: "_proposal",
  getUserId: () => user?.id ?? null,
  greetingAssistantText: "Hello!",
});
```

## Theming (default UI)

Default styles inject once and honor CSS variables on `.sunny-chat`, for example:

```css
.sunny-chat {
  --chat-fab-bg: #0f766e;
  --chat-user-bg: #0f766e;
}
```

## Assistant content (markdown + XSS)

Default bubbles run **marked** → **DOMPurify** and open links in a new tab. Override with `renderAssistantContent` on `MessageList` / `SunnyChat` for strict React-only rendering.

## License

MIT
