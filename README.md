# sunny-chat

React chatbox library implementing the streaming chat contract described in `Businesslogic.md`: **SSE parsing, session IDs, history merge rules, abort, quick replies, analytics callbacks, and optional default UI** — so your app only supplies **configuration** (URLs, `teamName`, `sessionIdSuffix`, `getUserId`, copy).

## Install (GitHub only — no npmjs.com)

Source: [github.com/sunny-theomano/SunnyChat](https://github.com/sunny-theomano/SunnyChat).

1. In your app’s `package.json`, depend on the repo (pick **one** form):

**HTTPS (recommended — works without GitHub SSH keys)**

The `github:org/repo` shorthand often resolves to `git@github.com:…` and fails with `Permission denied (publickey)` if you have not set up SSH. Prefer HTTPS:

```json
{
  "dependencies": {
    "sunny-chat": "git+https://github.com/sunny-theomano/SunnyChat.git#main"
  }
}
```

Use `main` or another branch to match GitHub. Pin a tag or commit: `#v0.1.0` or `#abc1234`.

**Shorthand (only if Git SSH to GitHub already works on your machine)**

```json
{
  "dependencies": {
    "sunny-chat": "github:sunny-theomano/SunnyChat#main"
  }
}
```

2. Install:

```bash
npm install
# or: yarn install
```

**If install fails with `exit code: 128` and `Permission denied (publickey)`:** your package manager is using SSH (`git@github.com`). Switch the dependency to the **`git+https://github.com/...`** form above, or [add an SSH key to GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

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
      apiKey={import.meta.env.VITE_FRONTEND_API_KEY}
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
| `baseUrl` | API origin only (no `/agents/chat` suffix). The library uses `POST ${baseUrl}/agents/chat` and `GET ${baseUrl}/agents/chat/history/:userId`. |
| `teamName` | Backend routing (e.g. `generac-team`, `ritz-team`) |
| `sessionIdSuffix` | Thread namespace per surface (e.g. `_proposal`, `_generac_offer`) |
| `getUserId` | Stable user id; library generates anonymous id if null |
| `greetingAssistantText` | Seed when history is empty |

### Optional

- `apiKey` — frontend API key; sent as `Authorization: Bearer …` on chat + history (and voice when used)
- `quickQuestions` — suggestion chips above the composer; see **`quickReplyBehavior`** below
- **`quickReplyBehavior`** — `welcome` (default): chips only before the first user message; `always`: chips stay visible whenever `quickQuestions` is set (closer to persistent AI Elements suggestions)
- `sanitizeHistory` / `filterUiMessages` / `shouldSkipAutoSend` — loader / hidden-prompt flows
- `parseChunk` — extend SSE JSON handling beyond `RunContent` / `RunCompleted`
- `connectionErrorText` — assistant bubble text on network/HTTP failure
- `initialOpen` — open panel without FAB (e.g. embedded concierge)
- `defaultChrome={false}` — render thread + composer only; you provide shell / FAB

## Vercel AI Elements

While the assistant reply is streaming, a **default typing indicator** (three animated dots) appears **inside the last assistant bubble** until the first non-whitespace text chunk arrives — for both **`SunnyChatBuiltinAiElements`** / **`SunnyChatAiElements`** and the default **`SunnyChat`** message list (`MessageList` receives `loading` automatically). Override with the optional **`Loader`** slot on AI Elements, or **`renderAssistantContent`** on `SunnyChat`, if you need a custom look.

### Zero-setup built-in UI

Use **`SunnyChatBuiltinAiElements`** when you want the same slot contract as [Vercel AI Elements](https://elements.ai-sdk.dev) (conversation, markdown messages, prompt input) **without** installing the shadcn registry or Tailwind in your app. Styling is scoped CSS and respects the same `sunny-chat` CSS variables as the default widget.

```tsx
import { SunnyChatBuiltinAiElements } from "sunny-chat";

export function App() {
  return (
    <SunnyChatBuiltinAiElements
      baseUrl={import.meta.env.VITE_API_BASE}
      teamName="generac-team"
      sessionIdSuffix="_generac_offer"
      getUserId={() => null}
      greetingAssistantText="Hi! How can I help?"
      quickQuestions={["Summarize this", "What are the risks?", "Next steps"]}
      quickReplyBehavior="always"
      composerPlaceholder="Message…"
    />
  );
}
```

Optional: `aiElementsOptions` — same keys as for **`SunnyChatAiElements`** (class names on conversation, prompt, per-role messages, submit label, etc.). For the **builtin** skin only, you can also pass **`builtinUi`**: it merges into `aiElementsOptions` / `ui.rootStyle` and supports **`themeVars`** for common CSS variables (`userBubbleBackground` → `--chat-user-bg`, `messagesAreaBackground` → `--chat-messages-bg`, `composerBackground` → `--chat-composer-bg`, `inputBackground` → `--chat-input-bg`, send colors → `--chat-fab-bg` / `--chat-fab-fg`, …). Use **`rootClassName`** / **`rootStyle`** on `builtinUi` for Tailwind scope or extra variables. The slot **names and shapes** stay identical to Vercel AI Elements.

```tsx
<SunnyChatBuiltinAiElements
  baseUrl="…"
  teamName="…"
  sessionIdSuffix="…"
  getUserId={() => null}
  greetingAssistantText="Hi!"
  builtinUi={{
    rootClassName: "rounded-2xl shadow-lg",
    themeVars: {
      userBubbleBackground: "#0f172a",
      assistantBubbleBackground: "#f1f5f9",
      messagesAreaBackground: "#fafafa",
      sendButtonBackground: "#0ea5e9",
    },
    userBubbleClassName: "shadow-sm",
    assistantBubbleClassName: "border border-slate-200",
    promptTextareaClassName: "font-medium",
    promptSubmitLabel: "Send",
    conversationContentClassName: "px-2",
  }}
/>
```

Advanced use: import **`builtinAiElementsSlots`** and pass them to **`SunnyChatAiElements`** or **`sunnyChatAiElementsRenderers`** if you wrap or replace individual slots.

### Official registry components

Use [Vercel AI Elements](https://elements.ai-sdk.dev) for the transcript and prompt UI while keeping Sunny transport, history, and quick replies. In your app, add AI Elements the usual way (Tailwind + shadcn/ui, then e.g. `npx ai-elements@latest` or the registry URLs from the docs) so you have components such as `conversation`, `message`, and `prompt-input`.

When using **`SunnyChatAiElements`** with registry components, ensure **`Message`**, **`MessageContent`**, **`MessageResponse`**, **`ConversationContent`**, and **`PromptInput*`** forward a `className` prop (and **`PromptInputSubmit`** forwards `children`) so `aiElementsOptions` styling applies. The capability table below compares built-in vs registry; the code sample after it wires `aiElements` into **`SunnyChatAiElements`**.

| Capability | Built-in (`SunnyChatBuiltinAiElements`) | With [AI Elements](https://elements.ai-sdk.dev) |
|------------|----------------------------------------|--------------------------------------------------|
| Chat bubbles / layout | Yes | `Message`, `MessageContent` |
| Streaming text | Yes (`useChatSession` + last assistant bubble) | Same transport; use `MessageResponse` + **Streamdown** for richer streaming markdown |
| Auto-scroll + jump-to-bottom | Yes (`Conversation` + stick-to-bottom) | Registry `Conversation` / `ConversationScrollButton` |
| Markdown | Yes (`marked` + DOMPurify) | Prefer registry `MessageResponse` (often Streamdown) |
| Code highlighting | Yes (**highlight.js** in markdown pipeline) | Streamdown `code` plugin or Shiki in your app |
| Suggestion chips | Yes — **`PromptSuggestions`** slot wraps `quickQuestions` (builtin styled row); `aiElementsOptions.promptSuggestionsClassName` | Map registry **`PromptSuggestions`** (or equivalent) to slot **`PromptSuggestions`** |
| Loading | Streaming row + submit `status="streaming"` | Match with `Loader`, `PromptInputSubmit` |
| Tool calls | Renders `toolInvocations` (compact or **`ToolInvocation`** slot) | Map your registry tool UI to slot **`ToolInvocation`** |
| Citations | Renders `sources` (compact or **`MessageSources`** slot) | Map e.g. `Sources` / citations component to **`MessageSources`** |

Stream extras: implement **`parseChunk`** to return `{ kind: "assistant_sources", sources: [...] }` or `{ kind: "assistant_tool", tool: { name, state, id?, result? } }` so the UI updates during the same reply. History API may return `sources` / `toolInvocations` (or `tools`) on each message object — they are normalized automatically.

```tsx
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
// When your AI Elements build exports PromptSuggestions, import it and add to `aiElements` below.
import { SunnyChatAiElements } from "sunny-chat";

const aiElements = {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  // Optional — wire when you use RAG / tools (names match sunny-chat slots):
  // MessageSources: Sources,
  // ToolInvocation: Tool,
  // Loader: Loader,
  PromptInput,
  // PromptSuggestions, // optional — wraps `quickQuestions` when your registry exports this component
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  ConversationScrollButton,
};

export function App() {
  return (
    <SunnyChatAiElements
      aiElements={aiElements}
      baseUrl={import.meta.env.VITE_API_BASE}
      teamName="generac-team"
      sessionIdSuffix="_generac_offer"
      getUserId={() => null}
      greetingAssistantText="Hi! How can I help?"
      composerPlaceholder="Message…"
    />
  );
}
```

Optional **`aiElementsOptions`**: all keys from **`SunnyChatAiElementsRenderersOptions`** (conversation / message list / prompt class names, per-role bubbles, `promptSubmitLabel`, `markdownUserMessages`, …). Use **`mergeSunnyChatAiElementsOptions`** if you compose options in code.

If you prefer to memoize render props yourself, import **`sunnyChatAiElementsRenderers`** and spread the result onto **`SunnyChat`** as `renderMessageList` and `renderComposer`.

**`renderMessageList`:** receives **`(messages, { loading })`** so you can show typing indicators or disable controls while streaming.

**Composer API:** custom `renderComposer` callbacks receive **`sendText(text)`** so uncontrolled inputs (AI Elements `PromptInput`) can send without syncing React state to `value` first. They also receive **`composerPlaceholder`**.

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
- **`renderComposer` / `renderMessageList`** — still the escape hatch to replace the whole composer or transcript while keeping `useChatSession` behavior via `SunnyChat`. The composer context includes **`sendText(message)`** for uncontrolled UIs (e.g. Vercel AI Elements `PromptInput`) and **`composerPlaceholder`**. Custom **`renderMessageList(messages, { loading })`** receives **`loading`** while the assistant stream is active.

TypeScript: `SunnyChatUi`, `MessageListUi`, `ChatComposerUi` in the package exports.

## Assistant content (markdown + XSS)

Default bubbles run **marked** → **DOMPurify** and open links in a new tab. Override with `renderAssistantContent` on `MessageList` / `SunnyChat` for strict React-only rendering.

## License

MIT


## Realtime Voice

SunnyChat now ships an additive realtime hook for voice-first chat surfaces.

```tsx
import { useRealtimeChatSession } from "sunny-chat";

const chat = useRealtimeChatSession({
  baseUrl: import.meta.env.VITE_API_BASE,
  getUserId: () => "demo-user",
  initialInstructions: "Greet the user and ask how you can help.",
});
```

Pass **`baseUrl`** (API origin only, same as text chat) and the hook will call `POST ${baseUrl}/api/voice/session` for the ephemeral token and wire the default voice RAG tool handlers (`search_docs`, memory, design/financing data, etc.). Override individual tools with `toolHandlers`, or supply `getSessionToken` / `sessionTokenEndpoint` if your backend differs.

The new [`examples/realtime-voice`](./examples/realtime-voice/README.md) app shows a full chat UI with a text composer and a live mic/session toggle built on top of the hook.
