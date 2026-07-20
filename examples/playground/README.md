# SunnyChat Playground

Local UI to exercise **SunnyChat** against a **real** backend. Enter API details in the sidebar, connect, and stream live SSE (`RunContent` / `RunCompleted`).

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

Opens at [http://localhost:5173](http://localhost:5173) (or the next free port).

## What it does

- **Connection form** — `baseUrl`, **chat surface** (pre-proposal / post-proposal / default), optional `apiKey`, `teamName`, `sessionIdSuffix`, `userId`, greeting, and quick questions.
- **Live chat** — uses real `fetch`:
  - Pre-proposal → `POST ${baseUrl}/agents/pre-proposal/chat`
  - Post-proposal → `POST ${baseUrl}/agents/post-proposal/chat`
  - Default → `POST ${baseUrl}/agents/chat`
  - History always → `GET ${baseUrl}/agents/chat/history/:userId`
- **Persistence** — form values are saved in `localStorage`.
- **Analytics log** — shows `onAnalytics` events in real time.

## CORS

The browser must be allowed to call your API from the playground origin. If Network shows a CORS error, enable CORS on the API for `http://localhost:5173` (or whichever port Vite used).
