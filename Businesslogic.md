# Chatbox / streaming chat — business logic (library-ready)

This document is **separate** from `BUSINESS_LOGIC.md`. It describes the **domain behavior, API contracts, and UI boundaries** of the Sunny-style chat so you can extract a **standalone chat package** (e.g. `@org/sunny-chat`) and drop it into **other repos** with **fully configurable presentation**.

It is derived from the current implementation in:

| Concern | Reference files |
|--------|------------------|
| Generac floating chat | `src/components/Generac/GeneracChat/GeneracChat.jsx` |
| Proposal + concierge chat | `src/components/App2.1/ProposalPageLive/ProposalPageLive.jsx` |
| Loader quiz chat | `src/components/App2.1/ProposalLoaderV2/ProposalLoaderV2.js` |
| Chat history fetch | `src/context/DataContext.js` (`loadChatHistory`, `GET /chat/history/...`) |
| History sanitization | `src/utils/chatHistorySanitize.js` |
| Proposal shell state (open + suggestions) | `src/context/ProposalChatContext.js` |

---

## 1. Product intent

- **User goal:** Ask questions about solar / offer / next steps; get **streaming** assistant replies in a thread.
- **System goal:** One **HTTP streaming** channel to an agent backend, keyed by **user**, **team**, and **session**, with optional **persisted history** per user.
- **Library goal:** Own **transport, stream parsing, message state, abort, history merge rules**; **do not** own app routing, proposal steps, or CRM—those are **host callbacks** or **injected services**.

---

## 2. Recommended package split (for reuse + configurable UI)

| Layer | Responsibility | Configurable? |
|-------|------------------|---------------|
| **`@org/chat-core`** (framework-agnostic) | Build `POST /chat` body; parse SSE chunks; normalize events → text deltas; optional `fetch` wrapper; types | No UI |
| **`@org/chat-react`** (headless) | `useChatSession` hook: messages, loading, send, abort, hydrate history, refs for scroll | No visual DOM |
| **`@org/chat-ui`** (optional) | Default panel / FAB / bubbles using CSS variables or `className` prefix | Yes—theme tokens + **slots** |
| **Host app** | `userId`, `team_name`, `session_id` suffix, analytics, auth headers, design assets | Full branding |

**Fully configurable UI** in practice means:

1. **Headless first:** host can ignore `@org/chat-ui` and render from `useChatSession` state only.
2. **Render props / slots:** e.g. `renderMessage`, `renderComposer`, `renderLauncher`, `renderHeader`, `renderQuickReplies`.
3. **Design tokens:** CSS variables (`--chat-user-bg`, `--chat-assistant-bg`, `--chat-radius`, …) or a `theme` object mapped to inline classes (host choice).
4. **No hard-coded mascot** in core: avatar `src` comes from props or slot.

---

## 3. External contracts (backend)

### 3.1 `POST {BASE_URL}/agents/chat`

**Transport:** `fetch` with `Accept: text/event-stream`, **ReadableStream** read in a loop.

**JSON body (logical contract):**

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `message` | string | yes | User text (or hidden system/user prompt—see §7). |
| `user_id` | string | yes | Stable id; if missing in UI, generate anonymous id (prefix + random + time). |
| `stream` | boolean | yes | Must be `true` for streaming behavior described here. |
| `monitor` | boolean | yes | Today always `true` in app (`GeneracChat`, `ProposalPageLive`, `ProposalLoaderV2`). |
| `session_id` | string | yes | **Namespace** for this thread (see §5). |
| `team_name` | string | yes | **Routes agent / prompt** on backend (e.g. `ritz-team`, `generac-team`). |

**Base URL:** today `REACT_APP_V3_BASE_URL`; the library takes a single `baseUrl` (origin) and derives `POST …/agents/chat` and `GET …/agents/chat/history/:userId` internally. Optional `apiKey` is sent as `Authorization: Bearer …`.

### 3.2 Stream protocol (SSE-style chunks)

Implementation splits the decoded body on **double newlines** `\n\n`, then **JSON.parse** each complete block.

**Events consumed today:**

| `event` | Action |
|---------|--------|
| `TeamRunContent` | Append `content` string to the **current assistant** message (last bubble). |
| `TeamRunCompleted` | Optional “flush” signal; end-of-stream also handled when reader completes. |

**Ignored:** parse errors on a chunk are swallowed (partial chunk stays in buffer until next read).

**Library contract:** expose a pluggable `parseChunk(json)` if backends add events later; default parser matches the table above.

### 3.3 `GET {BASE_URL}/agents/chat/history/{userId}`

**Method:** GET, `Content-Type: application/json`.

**Response shape (normalized for UI):**

```jsonc
{
  "messages": [
    {
      "role": "user | assistant",
      "content": "…",   // preferred
      "msg": "…",       // legacy
      "message": "…"    // legacy
    }
  ]
}
```

**UI mapping:** `content = msg.message ?? msg.content ?? ""` (stringify safely).

---

## 4. Canonical message model (library internal)

Use a single shape in the hook:

```ts
type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string; // plain user text; assistant may be markdown/HTML after render step
};
```

**Streaming invariant:** when a user sends, append `{ role: "user", content }` then append `{ role: "assistant", content: "" }` immediately; stream **mutates only the last assistant** `content` until complete.

---

## 5. Session identity (multi-surface isolation)

**Problem:** Same `user_id` can open chat on proposal, Generac offer, loader, concierge—threads must not collide.

**Pattern in app:**

- `session_id = (userId || anonymousId) + sessionIdSuffix`
- Suffix examples:
  - `_proposal` — main proposal floating chat
  - `_proposal_concierge` — full-page concierge
  - `_generac_offer` — Generac widget

**Library config (required):**

| Config | Example |
|--------|---------|
| `getUserId()` | from URL, auth context, or props |
| `sessionIdSuffix` | `"_myapp_checkout"` |
| `generateAnonymousId()` | injectable for tests; default implementation matches current random id |

**`team_name`:** must be configurable per host (Generac vs Castaways vs future brands).

---

## 6. History load & merge rules (business-critical)

### 6.1 When to fetch

- Trigger `loadHistory(userId)` when the **panel opens** (or when host enables chat), not on every render.
- Guard with a ref: “already requested for this open cycle” to avoid duplicate GETs.

### 6.2 When **not** to replace `messages` with API history

Do **not** overwrite local `messages` if:

- User already has a **user** message in the thread (they started typing / sent before history arrived), or
- Host explicitly sent a message in the same tick as open (“optimistic” or hidden prompt).

This matches the `hasUserMessage` / `hasInteracted` style checks in `GeneracChat` and `ProposalPageLive`.

### 6.3 Empty history

- If GET returns empty or no messages: seed with **one assistant greeting** (configurable string).

### 6.4 Loading UX

- While `GET` is in flight and panel is open: show skeleton (host-rendered via `renderLoading` or default UI package).

---

## 7. Hidden / system messages & sanitization

Some flows post **large hidden user prompts** (e.g. loader quiz context) or strip **legacy assistant bubbles** from persisted history.

**Library recommendation:**

1. **`sanitizeHistoryPayload(apiJson)`** — optional, host-supplied or default no-op.
2. **`filterUiMessages(messages)`** — removes messages that should never render (markers in text).
3. **`shouldSkipAutoSend(messages)`** — e.g. skip auto-outreach if an assistant reply already exists above a length threshold (`shouldSkipLoaderHiddenOutreachSend` in `chatHistorySanitize.js`).

**Constants** today live in `chatHistorySanitize.js` (`LOADER_OUTREACH_PROMPT_USER_MARKER`, `LOADER_LEGACY_GREETING_SNIPPET`). The extracted library should either:

- ship these as **default plugins** for Sunny loaders, or  
- require the host to pass **marker strings** so other products don’t inherit Solar-specific copy.

---

## 8. Send pipeline & abort

1. **Abort** any in-flight `POST` via `AbortController` before starting a new send.
2. On `AbortError`: exit quietly (no error bubble).
3. On HTTP/network failure: set assistant text to a **configurable fallback** string (today: *“I'm having trouble connecting…”*).
4. **Enter to send**, **Shift+Enter** newline (current textarea behavior).

---

## 9. Markdown & HTML safety (assistant bubbles)

Today assistant content is passed through **marked** and rendered with **`dangerouslySetInnerHTML`** in places.

**Library rules:**

- **Default:** run markdown → HTML in the **UI layer**, not in core (core stays strings).
- **Security:** host must either use a **strict sanitizer** (DOMPurify, etc.) or render markdown-to-React without raw HTML.
- **Links:** Generac chat customizes `marked` renderer so links open with `target="_blank"` and `rel="noopener noreferrer"`.

Expose: `renderAssistantContent(text) => ReactNode` as the preferred extension point.

---

## 10. Quick replies (optional feature)

- Config: `quickQuestions: string[]`.
- Shown when: panel open, history ready, **no user interaction yet**, thread length ≤ 1 (greeting only).
- On click: call same `sendMessage(text, { fromQuickQuestion: true })`.

---

## 11. Analytics (host-owned)

The app fires PostHog events (e.g. `generac_proposal_chat_message_send`). **The library must not hard-code PostHog.**

**Callback contract:**

```ts
type ChatAnalyticsEvent =
  | { type: "fab_open" }
  | { type: "panel_close" }
  | { type: "message_send"; fromQuickQuestion: boolean }
  | { type: "quick_question_click"; question: string };

onAnalytics?(event: ChatAnalyticsEvent, context: { sessionIdSuffix: string; teamName: string });
```

Host maps events to PostHog / GA4 / etc.

---

## 12. `ProposalChatContext` (host concern, not chat-core)

`ProposalChatContext` tracks **proposal-page** UX: `isChatPanelOpen`, `selectedQuestion`, `suggestions`, `openChatWithQuestion`. That is **application orchestration**, not streaming transport.

**Library:** do not bundle this context. Host wraps chat with its own shell state.

---

## 13. Public API sketch (what you export from `@org/chat-react`)

```ts
type UseChatSessionConfig = {
  baseUrl: string;                       // API origin; package appends /agents/chat and /agents/chat/history/:userId
  apiKey?: string;                       // FRONTEND_API_KEY → Authorization: Bearer …
  teamName: string;
  sessionIdSuffix: string;
  getUserId: () => string | null;
  greetingAssistantText: string;
  quickQuestions?: string[];
  sanitizeHistory?: (data: unknown) => unknown;
  filterUiMessages?: (m: ChatMessage[]) => ChatMessage[];
  onAnalytics?: (e: ChatAnalyticsEvent, ctx: object) => void;
  fetchImpl?: typeof fetch;             // tests / interceptors
};

function useChatSession(cfg: UseChatSessionConfig): {
  messages: ChatMessage[];
  input: string;
  setInput: (s: string) => void;
  loading: boolean;
  isLoadingHistory: boolean;
  historyInitialized: boolean;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  sendMessage: (text?: string, opts?: { fromQuickQuestion?: boolean; hideUserMessage?: boolean }) => Promise<void>;
  abort: () => void;
  // …refs for scroll if needed
};
```

**Fully configurable UI:** host uses this hook and passes `messages` into their design system (MUI, shadcn, native, etc.).

---

## 14. Non-goals (keep out of the library)

- Proposal step machine, `DataContext` design/finance payloads, lease/checkout APIs.
- Generac vs Ritz **routing** — only `teamName` + `sessionIdSuffix` strings.
- PostHog identify, GTM, Hotjar — host only.

---

## 15. Consumer checklist (new repo)

1. [ ] Provide `baseUrl` (API origin) and `teamName`.
2. [ ] Define `sessionIdSuffix` per surface (checkout, marketing, logged-in app).
3. [ ] Wire `getUserId()` (URL param, JWT claim, etc.).
4. [ ] Implement UI with slots or headless hook only.
5. [ ] Decide markdown + XSS policy for assistant HTML.
6. [ ] Map `onAnalytics` to your analytics stack.
7. [ ] (Optional) Pass `sanitizeHistory` / `filterUiMessages` if you use hidden system prompts.
8. [ ] E2E: abort mid-stream, double-send, history arrives after user types, offline error string.

---

## 16. Appendix — parameter matrix (current app)

| Surface | `team_name` | `session_id` suffix | History via `DataContext` |
|---------|-------------|----------------------|----------------------------|
| `GeneracChat` | `generac-team` | `_generac_offer` | yes, when `user_id` present |
| `ProposalPageLive` chat | `ritz-team` | `_proposal` (default) | yes |
| Concierge full-page | `ritz-team` | `_proposal_concierge` | yes |
| `ProposalLoaderV2` | `ritz-team` | `_proposal` (in hook) | yes, when quiz done + chat enabled |

---

## 17. Versioning note

Backend **SSE JSON shape** (`TeamRunContent` / `TeamRunCompleted`) is a **public contract** between this frontend and `REACT_APP_V3_BASE_URL`. If the agent service adds events, bump **minor** version of `@org/chat-core` and extend the parser with backward compatibility.

---

*End of chatbox business logic document.*
