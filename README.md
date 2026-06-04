# sunny-chat

React chatbox library implementing the streaming chat contract described in `Businesslogic.md`: **SSE parsing, session IDs, history merge rules, abort, quick replies, analytics callbacks, and optional default UI** — so your app only supplies **configuration** (URLs, `teamName`, `sessionIdSuffix`, `getUserId`, copy).

## Install (GitHub only — no npm registry)

This library is meant to be consumed **from your GitHub repo**, not from npmjs.

1. Push this repo to GitHub (default metadata assumes `https://github.com/TheoMano/SunnyChat` — edit `repository` / `bugs` in this package’s `package.json` if your fork lives elsewhere).
2. In the **host app**, add a git dependency pointing at that repo (branch or tag optional):

**npm / pnpm / Bun**

```json
{
  "dependencies": {
    "sunny-chat": "github:TheoMano/SunnyChat#main"
  }
}
```

Then run `npm install` (or `pnpm install`, etc.).

**Exact commit or tag (recommended for stability)**

```json
"sunny-chat": "github:TheoMano/SunnyChat#v0.1.0"
```

**HTTPS URL (works everywhere)**

```json
"sunny-chat": "git+https://github.com/TheoMano/SunnyChat.git#main"
```

### Build on install

`dist/` is not committed; the package defines `"prepare": "npm run build"`. When someone installs from Git, npm runs `prepare` and produces `dist/` using `tsup` + `typescript` from `devDependencies`.

If installs skip lifecycle scripts (`npm install --ignore-scripts`), run `npm run build` inside `node_modules/sunny-chat` once, or re-install without ignoring scripts.

Peer: `react` ≥ 18 (and `react-dom` if you use the default UI in the browser).

## Testing (local playground)

This repo includes a **Vite + React** app under `examples/playground` that depends on the library via `file:../..`.

1. From the **repo root**, build the library (once, or after you change library source):

   ```bash
   npm run build
   ```

2. Configure API base URL for the playground:

   ```bash
   cp examples/playground/.env.example examples/playground/.env
   ```

   Edit `examples/playground/.env` and set `VITE_API_BASE` to your real backend root (the same host you use for `POST /chat` and `GET /chat/history/...` in production).

3. Install playground deps and start the dev server:

   ```bash
   npm install --prefix examples/playground
   npm run dev --prefix examples/playground
   ```

   Or from the repo root in one shot (build + install playground + open Vite):

   ```bash
   npm run playground
   ```

4. In the browser, click **Try chat**, send a message, and confirm streaming + history.

**CORS:** the playground origin is usually `http://localhost:5173`. Your API must allow that origin (or use a Vite `server.proxy` in `examples/playground/vite.config.ts` to proxy `/chat` to the API).

**Without a backend:** you will not get real replies; the UI still loads so you can check layout and composer behavior once `VITE_API_BASE` is set (failed requests show the library’s connection fallback on the assistant bubble).

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
