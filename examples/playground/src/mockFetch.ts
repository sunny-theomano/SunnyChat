import {
  MOCK_SCENARIOS,
  resolveMockResponse,
  type MockScenario,
} from "./mockResponses";

const MOCK_BASE = "http://mock.local";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sseBlock(payload: Record<string, unknown>) {
  const event =
    typeof payload.event === "string" ? payload.event : "message";
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function createStreamingResponse(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const tokens = text.match(/\S+\s*|\s+/g) ?? [text];

      for (const token of tokens) {
        controller.enqueue(
          encoder.encode(
            sseBlock({ event: "RunContent", content: token }),
          ),
        );
        await delay(25 + Math.random() * 35);
      }

      controller.enqueue(
        encoder.encode(sseBlock({ event: "RunCompleted" })),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

export type MockFetchOptions = {
  scenarios?: MockScenario[];
  /** Artificial delay before the stream starts (ms). */
  latencyMs?: number;
  /** When true, the next chat POST returns HTTP 500 (then auto-clears). */
  shouldSimulateError?: () => boolean;
};

export function createMockFetch(opts: MockFetchOptions = {}): typeof fetch {
  const scenarios = opts.scenarios ?? MOCK_SCENARIOS;

  const mockFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.includes("/agents/chat/history/") || url.includes("/chat/history/")) {
      await delay(opts.latencyMs ?? 120);
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      url.startsWith(MOCK_BASE) &&
      (url.endsWith("/agents/chat") || url.endsWith("/chat")) &&
      init?.method === "POST"
    ) {
      await delay(opts.latencyMs ?? 180);

      if (opts.shouldSimulateError?.()) {
        return new Response("Mock server error", { status: 500 });
      }

      let message = "";
      try {
        const body = JSON.parse(String(init.body)) as { message?: string };
        message = body.message ?? "";
      } catch {
        message = "";
      }

      const responseText = resolveMockResponse(message, scenarios);
      return createStreamingResponse(responseText);
    }

    return new Response("Not found", { status: 404 });
  };

  return mockFetch;
}

export { MOCK_BASE };
