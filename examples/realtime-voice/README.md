# SunnyChat Realtime Voice Example

Chat-first example that connects to the existing voice agent backend over OpenAI Realtime WebRTC.

## Run

From the repo root:

```bash
npm run voice-example
```

Or from this folder:

```bash
npm install
npm run dev
```

Opens at [http://localhost:5174](http://localhost:5174).

## Backend expectations

This example reuses the same backend contract as `agno-agents/templates/voice_rag/app.js`:

- `POST /api/voice/session`
- `POST /api/voice/search`
- `POST /api/voice/memory/search`
- `POST /api/voice/memory/save`
- `POST /api/voice/design_data`
- `POST /api/voice/financing_data`

Set `VITE_API_BASE_URL` or edit the API Base URL field in the UI if your backend is not running on `http://localhost:7777`.
