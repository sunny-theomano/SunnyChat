# sunny-chat — installation and API guide

This document explains how to install **sunny-chat** and how to use each public piece of the library. For backend contract details, see [Businesslogic.md](./Businesslogic.md). For extended theming and class-name tables, see [README.md](./README.md).

---

## 1. Installation

### Requirements

- **Node.js** with a package manager (`npm`, `yarn`, or `pnpm`).
- **React** ≥ 18 as a peer dependency.
- **react-dom** ≥ 18 if you render UI in the browser (optional peer; omit only for unusual SSR-only setups).

### From GitHub (recommended today)

The package is not assumed to be on the public npm registry. Add a **git** dependency so `npm install` clones the repo.

**HTTPS** (works without GitHub SSH keys):

```json
{
  "dependencies": {
    "sunny-chat": "git+https://github.com/sunny-theomano/SunnyChat.git#main"
  }
}
```

Pin a tag or commit with `#v0.1.0` or `#abc1234` instead of `#main` when you want reproducible installs.

**Shorthand** `github:org/repo` only if `git@github.com` already works on your machine.

Then install:

```bash
npm install
```

On install, the package runs **`prepare`** → **`npm run build`**, which produces **`dist/`**. You do not need to build it manually in the consumer app.

**If install fails with `Permission denied (publickey)`:** the resolver is using SSH. Switch to the `git+https://github.com/...` form above.

### From npm (if you publish)

After publishing, use:

```bash
npm install sunny-chat
```

### Peer dependencies

Install React in your app (version 18 or newer):

```bash
npm install react react-dom
```

---

## 2. Package entry

Everything is exported from the package root:

```ts
import { /* … */ } from "sunny-chat";
```

TypeScript types ship with **`dist/index.d.ts`**.

---

## 3. UI: all-in-one widget — `SunnyChat`

**Purpose:** Default floating chat (FAB + panel), streaming transport, history load, quick replies, and optional analytics hooks — minimal code in your app.

```tsx
import { SunnyChat } from "sunny-chat";

<SunnyChat
  baseUrl={import.meta.env.VITE_API_BASE}
  teamName="your-team"
  sessionIdSuffix="_surface"
  getUserId={() => currentUserId ?? null}
  greetingAssistantText="Hi! How can I help?"
  quickQuestions={["Option A", "Option B"]}
  quickReplyBehavior="welcome"
  onAnalytics={(event, ctx) => {
    /* wire to PostHog, GA, etc. */
  }}
/>
```

**Core props:**

| Area | Notes |
|------|--------|
| `baseUrl` | API origin only. Library calls `POST …/chat` and `GET …/chat/history/:userId`. |
| `teamName`, `sessionIdSuffix` | Routed to the backend with each request. |
| `getUserId` | Returns authenticated id or `null` (anonymous id is generated and persisted in-memory for the hook lifetime). |
| `greetingAssistantText` | Shown when history is empty or fails. |
| `quickQuestions` / `quickReplyBehavior` | Suggestion chips: `welcome` (default) vs `always`. |

**Customization:** `renderMessageList`, `renderComposer`, `renderHeader`, `renderUserContent`, `renderAssistantContent`, `ui` class names, `defaultChrome={false}`, `initialOpen`, `parseChunk`, `sanitizeHistory`, `filterUiMessages`, `shouldSkipAutoSend`, `connectionErrorText`, and more — see [README.md](./README.md).

**Types:** `SunnyChatProps`, `SunnyChatUi`, `SunnyChatMessageListContext`.

---

## 4. UI: Vercel AI Elements slot contract — `SunnyChatBuiltinAiElements`

**Purpose:** Same slot shapes as [Vercel AI Elements](https://elements.ai-sdk.dev) **without** installing the shadcn registry or Tailwind. Scoped CSS + CSS variables.

```tsx
import { SunnyChatBuiltinAiElements } from "sunny-chat";

<SunnyChatBuiltinAiElements
  baseUrl="https://api.example.com"
  teamName="your-team"
  sessionIdSuffix="_surface"
  getUserId={() => null}
  greetingAssistantText="Hello!"
  builtinUi={{
    themeVars: { userBubbleBackground: "#0f172a" },
    rootClassName: "rounded-2xl shadow-lg",
  }}
/>
```

**`builtinUi`:** merges styling for builtin slots (`themeVars` map to `--chat-*` variables, plus per-slot `className`s). Same session/transport props as `SunnyChat`.

**Types:** `SunnyChatBuiltinAiElementsProps`, `SunnyChatBuiltinAiElementsUi`, `SunnyChatBuiltinThemeVars`.

---

## 5. UI: bring your own AI Elements components — `SunnyChatAiElements`

**Purpose:** Wire your app’s AI Elements (or compatible) components while keeping Sunny transport and history behavior.

```tsx
import { SunnyChatAiElements } from "sunny-chat";

const aiElements = {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  ConversationScrollButton,
  // optional: MessageSources, ToolInvocation, Loader, PromptSuggestions
};

<SunnyChatAiElements
  aiElements={aiElements}
  baseUrl="…"
  teamName="…"
  sessionIdSuffix="…"
  getUserId={() => null}
  greetingAssistantText="Hi!"
/>
```

**Helpers:**

- **`mergeSunnyChatAiElementsOptions`** — deep-merge `aiElementsOptions` objects when composing styles in code.
- **`sunnyChatAiElementsRenderers`** — if you prefer to attach render props to `SunnyChat` yourself, spread this into `renderMessageList` / `renderComposer`.
- **`builtinAiElementsSlots`** — slot implementations from the builtin skin; pass into `SunnyChatAiElements` or `sunnyChatAiElementsRenderers` for hybrid UIs.

**Types:** `SunnyChatAiElementsProps`, `SunnyChatAiElementsRenderersOptions`, `SunnyChatAiElementsSlots`.

---

## 6. Headless hook — `useChatSession`

**Purpose:** Full chat state and network behavior **without** Sunny’s default chrome. Build any UI on top.

```tsx
import { useChatSession } from "sunny-chat";

const {
  messages,
  input,
  setInput,
  loading,
  isLoadingHistory,
  historyInitialized,
  isOpen,
  setIsOpen,
  sendMessage,
  sendAutoMessageIfNeeded,
  abort,
  showQuickReplies,
  quickQuestions,
  onQuickQuestion,
  sessionId,
  effectiveUserId,
} = useChatSession({
  baseUrl: "https://api.example.com",
  teamName: "your-team",
  sessionIdSuffix: "_surface",
  getUserId: () => user?.id ?? null,
  greetingAssistantText: "Hello!",
  quickQuestions: ["Quick 1", "Quick 2"],
  onAnalytics: (event, ctx) => {},
});
```

| Return value | Role |
|--------------|------|
| `messages` | `ChatMessage[]` for your list UI. |
| `input` / `setInput` | Controlled composer string. |
| `loading` | `true` while the assistant stream is in flight. |
| `isLoadingHistory` / `historyInitialized` | History fetch lifecycle. |
| `isOpen` / `setIsOpen` | Panel open state; opening/closing fires analytics when `onAnalytics` is set. |
| `sendMessage(text?, opts?)` | Send user text; optional `fromQuickQuestion`, `hideUserMessage`. |
| `sendAutoMessageIfNeeded(text)` | Hidden/context send after history is ready (e.g. page loader flows). |
| `abort()` | Abort in-flight stream. |
| `showQuickReplies` / `quickQuestions` / `onQuickQuestion` | Drive suggestion chips. |
| `sessionId` / `effectiveUserId` | Debugging or correlation. |

**Types:** `UseChatSessionConfig`, `SendMessageOptions`.

---

## 7. Primitives: message list and composer

Use these when you compose a custom layout but want Sunny’s default bubble/composer markup.

### `MessageList`

Renders a column of user/assistant rows. Assistant messages use **markdown → HTML** (marked + DOMPurify) unless you override.

```tsx
import { MessageList } from "sunny-chat";

<MessageList
  messages={messages}
  loading={loading}
  ui={{ className: "mt-2" }}
  renderAssistantContent={(text) => <YourMarkdown text={text} />}
/>
```

**Types:** `MessageListProps`, `MessageListUi`.

### `ChatPendingReply`

Typing indicator (three dots) used inside the last assistant bubble while `loading` is true and content is still empty. Normally used via `MessageList`; you can reuse it in custom rows.

```tsx
import { ChatPendingReply } from "sunny-chat";
```

### `ChatComposer`

Controlled textarea + send row, optional `slotBefore` (e.g. quick replies).

```tsx
import { ChatComposer } from "sunny-chat";

<ChatComposer
  value={input}
  onChange={setInput}
  onSend={() => void sendMessage()}
  disabled={loading}
  placeholder="Message…"
  slotBefore={/* chips */}
  ui={{ sendButtonLabel: "Send" }}
/>
```

**Types:** `ChatComposerProps`, `ChatComposerUi`.

---

## 8. Markdown hook — `useMarkedHtml`

**Purpose:** Turn a **markdown string** into **sanitized HTML** with the same pipeline as default assistant bubbles (links open in a new tab; code blocks use highlight.js where language is known).

```tsx
import { useMarkedHtml } from "sunny-chat";

function AssistantHtml({ markdown }: { markdown: string }) {
  const html = useMarkedHtml(markdown);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**Note:** Intended for the browser (DOMPurify). SSR-only usage may return unsanitized raw HTML from marked; prefer `renderAssistantContent` without `dangerouslySetInnerHTML` for strict server rendering.

---

## 9. Core: streaming and URLs

### `streamChatResponse`

Low-level **POST** + **SSE-style** JSON blocks (`\n\n`-delimited JSON). Invokes `onDelta` for text chunks and `onParseChunk` for every `ParseChunkResult`.

```ts
import { streamChatResponse, resolveChatUrl } from "sunny-chat";

await streamChatResponse({
  url: resolveChatUrl(baseUrl),
  body: {
    message: "Hello",
    user_id: userId,
    stream: true,
    monitor: true,
    session_id: sessionId,
    team_name: teamName,
  },
  signal: controller.signal,
  onDelta: (text) => { /* append to UI */ },
  onParseChunk: (r) => { /* sources / tools if you extend parseChunk */ },
  onComplete: () => {},
});
```

**Types:** `StreamChatParams`, `StreamChatBody`.

### `resolveChatUrl` / `resolveHistoryUrl`

| Function | URL |
|----------|-----|
| `resolveChatUrl(baseUrl)` | `POST ${base}/chat` |
| `resolveHistoryUrl(baseUrl, userId)` | `GET ${base}/chat/history/${encodeURIComponent(userId)}` |

Trailing slashes on `baseUrl` are normalized.

### `defaultParseChunk` / `extractJsonBlocks`

- **`defaultParseChunk`** — maps Sunny backend events `TeamRunContent` (text deltas) and `TeamRunCompleted` to `ParseChunkResult`. Unknown events → `ignore`.
- **`extractJsonBlocks`** — splits a decoded stream buffer on `\n\n` and `JSON.parse`s complete blocks; use if you implement a custom reader around `fetch` streams.

Extend parsing by passing a custom **`parseChunk`** to `useChatSession` / `SunnyChat` / `streamChatResponse` that returns:

- `{ kind: "assistant_delta", text }`
- `{ kind: "assistant_complete" }`
- `{ kind: "assistant_sources", sources }`
- `{ kind: "assistant_tool", tool }`
- `{ kind: "ignore" }`

---

## 10. Core: session and history helpers

### `generateAnonymousId` / `buildSessionId`

```ts
import { generateAnonymousId, buildSessionId } from "sunny-chat";

const anon = generateAnonymousId(); // default prefix anon_
const sessionId = buildSessionId({
  userId: authIdOrNull,
  anonymousId: anon,
  sessionIdSuffix: "_my_surface",
});
```

`useChatSession` already does this when `getUserId()` returns `null`.

### `normalizeHistoryMessages` / `hasUserMessage`

```ts
import { normalizeHistoryMessages, hasUserMessage } from "sunny-chat";

const messages = normalizeHistoryMessages(apiJson);
if (hasUserMessage(messages)) {
  /* … */
}
```

**`normalizeHistoryMessages`** accepts typical API shapes (`messages[]` with `role`, `content` / `msg` / `message`, optional `sources`, `toolInvocations` / `tools`).

---

## 11. Exported types (reference)

Import from `"sunny-chat"` for TypeScript:

| Type | Meaning |
|------|--------|
| `ChatMessage` | `{ role, content, sources?, toolInvocations? }` |
| `ChatRole` | `"user" \| "assistant"` |
| `ChatSource` | Citation: `{ title, url? }` |
| `ChatToolInvocation` | Tool row: `{ id?, name, state, args?, result? }` |
| `ChatAnalyticsEvent` / `ChatAnalyticsContext` | Analytics callback payloads |
| `ParseChunkResult` | Union returned by `parseChunk` |
| `StreamEventPayload` | `Record<string, unknown>` for raw SSE JSON |

---

## 12. Quick decision guide

| Goal | Use |
|------|-----|
| Fastest integration, default look | `SunnyChat` |
| AI Elements layout, no Tailwind in app | `SunnyChatBuiltinAiElements` |
| Official AI Elements / shadcn components | `SunnyChatAiElements` |
| Fully custom React UI | `useChatSession` + your components (optionally `MessageList`, `ChatComposer`) |
| Non-React or custom transport wiring | `streamChatResponse`, `resolveChatUrl`, `defaultParseChunk` |
| Reuse markdown pipeline only | `useMarkedHtml` |

---

## License

MIT (same as the package).
