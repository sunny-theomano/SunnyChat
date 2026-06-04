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
| `baseUrl` | API origin only (no `/chat` suffix). The library uses `POST ${baseUrl}/chat` and `GET ${baseUrl}/chat/history/:userId`. |
| `teamName` | Backend routing (e.g. `generac-team`, `ritz-team`) |
| `sessionIdSuffix` | Thread namespace per surface (e.g. `_proposal`, `_generac_offer`) |
| `getUserId` | Stable user id; library generates anonymous id if null |
| `greetingAssistantText` | Seed when history is empty |

### Optional

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
  baseUrl: "https://api.example.com",
  teamName: "ritz-team",
  sessionIdSuffix: "_proposal",
  getUserId: () => user?.id ?? null,
  greetingAssistantText: "Hello!",
});
```

## Theming (default UI)

Default styles inject once. Target the root with **`sunny-chat`** (the `ROOT` constant in source): the outer wrapper is always `class="sunny-chat"` plus any `className` you pass on `SunnyChat`.

### CSS variables (on `.sunny-chat`)

These are read by the injected theme; override them in your own stylesheet:

| Variable | Used for |
|----------|-----------|
| `--chat-user-bg` | User bubble background |
| `--chat-user-fg` | User bubble text |
| `--chat-assistant-bg` | Assistant bubble background |
| `--chat-assistant-fg` | Assistant bubble text |
| `--chat-radius` | Corners (panel, bubbles, inputs) |
| `--chat-panel-bg` | Panel background |
| `--chat-panel-border` | Panel / header / composer borders |
| `--chat-fab-bg` | FAB and send button background |
| `--chat-fab-fg` | FAB and send button text |
| `--chat-shadow` | FAB and panel shadow |

Example:

```css
.sunny-chat {
  --chat-fab-bg: #0f766e;
  --chat-user-bg: #0f766e;
}
```

You can also set the same variables inline via `ui.rootStyle` (e.g. `{ "--chat-user-bg": "#059669" } as React.CSSProperties`).

### Default class names (override in CSS)

All classes are prefixed with **`sunny-chat__`**. Use them in your app CSS after the default style tag loads (or rely on cascade if your rules come later).

| Class | Element / role |
|-------|------------------|
| `.sunny-chat` | Root wrapper (`SunnyChat` `className` is appended here) |
| `.sunny-chat__fab` | Floating “open chat” launcher (`defaultChrome` only) |
| `.sunny-chat__backdrop` | Full-screen dimmed overlay behind the panel |
| `.sunny-chat__panel` | Fixed chat panel shell |
| `.sunny-chat__header` | Default title bar (skipped if you pass `renderHeader`) |
| `.sunny-chat__close` | Default close control in the header |
| `.sunny-chat__body` | Scrollable transcript region |
| `.sunny-chat__skeleton` | “Loading conversation…” placeholder |
| `.sunny-chat__messages` | Column of messages |
| `.sunny-chat__row` | Single message row |
| `.sunny-chat__row--user` | User row (align end); `data-role="user"` |
| `.sunny-chat__row--assistant` | Assistant row (align start); `data-role="assistant"` |
| `.sunny-chat__bubble` | Bubble chrome around one message |
| `.sunny-chat__text` | Default plain-text body for **user** messages |
| `.sunny-chat__md` | Default assistant HTML (markdown) body |
| `.sunny-chat__quick` | Quick-reply chips row above the composer |
| `.sunny-chat__quickBtn` | One quick-reply chip |
| `.sunny-chat__composer` | Composer `<form>` |
| `.sunny-chat__composerRow` | Flex row: textarea + send |
| `.sunny-chat__input` | Message `<textarea>` |
| `.sunny-chat__send` | Default submit button |

### Extra classes via `ui` (no global CSS required)

`SunnyChat` forwards optional class names so you can use utility frameworks (Tailwind, etc.) without writing selectors for every inner node:

| `ui` field | Appended to |
|------------|-------------|
| `ui.messages.className` | `.sunny-chat__messages` |
| `ui.messages.userRowClassName` | `.sunny-chat__row.sunny-chat__row--user` |
| `ui.messages.assistantRowClassName` | `.sunny-chat__row.sunny-chat__row--assistant` |
| `ui.messages.userBubbleClassName` | user row `.sunny-chat__bubble` |
| `ui.messages.assistantBubbleClassName` | assistant row `.sunny-chat__bubble` |
| `ui.composer.formClassName` | `.sunny-chat__composer` |
| `ui.composer.rowClassName` | `.sunny-chat__composerRow` |
| `ui.composer.inputClassName` | `.sunny-chat__input` |
| `ui.composer.sendButtonClassName` | `.sunny-chat__send` (ignored if `renderSendButton` is set) |

`ui.messages` / `ui.composer` are ignored when you replace those trees with `renderMessageList` or `renderComposer`. Custom `renderHeader` removes the default `.sunny-chat__header` / `__close` markup (style those in your own header instead).

### Custom bubble and composer UI

- **`renderUserContent` / `renderAssistantContent`** — replace the **body** inside the default bubbles for sent vs received messages (layout/alignment and bubble chrome stay the default unless you use `renderMessageList` or `ui.messages.*ClassName` to style them).
- **`ui.composer`** — `sendButtonLabel`, extra classes on the form / textarea / send button, `inputProps` merged onto the textarea, or `renderSendButton({ disabled, send })` for a fully custom send control.
- **`renderComposer` / `renderMessageList`** — still the escape hatch to replace the whole composer or transcript while keeping `useChatSession` behavior via `SunnyChat`.

TypeScript: `SunnyChatUi`, `MessageListUi`, `ChatComposerUi` in the package exports.

## Assistant content (markdown + XSS)

Default bubbles run **marked** → **DOMPurify** and open links in a new tab. Override with `renderAssistantContent` on `MessageList` / `SunnyChat` for strict React-only rendering.

## License

MIT
