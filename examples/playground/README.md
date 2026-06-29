# SunnyChat Playground

Local UI to exercise **SunnyChat** against a mock backend — no real API required.

## Run

From the repo root:

```bash
npm run playground
```

Or from this folder:

```bash
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## What it does

- **`fetchImpl` mock** — intercepts `POST /chat` and `GET /chat/history/:userId`, streams SSE `TeamRunContent` / `TeamRunCompleted` events.
- **Preset scenarios** — sidebar lists mock Q&A pairs; the same questions appear as quick-reply chips in the widget.
- **Controls** — reset the session or toggle “fail next message” to test error handling.
- **Analytics log** — shows `onAnalytics` events in real time.

Edit mock copy in `src/mockResponses.ts`.
