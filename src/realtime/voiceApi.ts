import type { RealtimeToolHandler } from "./types.js";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function joinVoicePath(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** `POST ${baseUrl}/api/voice/session` */
export function resolveVoiceSessionUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/session");
}

/** `POST ${baseUrl}/api/voice/search` */
export function resolveVoiceSearchUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/search");
}

/** `POST ${baseUrl}/api/voice/memory/search` */
export function resolveVoiceMemorySearchUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/memory/search");
}

/** `POST ${baseUrl}/api/voice/memory/save` */
export function resolveVoiceMemorySaveUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/memory/save");
}

/** `POST ${baseUrl}/api/voice/design_data` */
export function resolveVoiceDesignDataUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/design_data");
}

/** `POST ${baseUrl}/api/voice/financing_data` */
export function resolveVoiceFinancingDataUrl(baseUrl: string): string {
  return joinVoicePath(baseUrl, "/api/voice/financing_data");
}

export type VoiceApiRequestOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

async function postVoiceJson<T>(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

function readStringArg(args: unknown, key: string): string {
  return typeof args === "object" && args && key in args
    ? String((args as Record<string, unknown>)[key] ?? "")
    : "";
}

/** Default voice RAG tool handlers for the standard Sunny voice backend contract. */
export function createDefaultVoiceToolHandlers(
  options: VoiceApiRequestOptions,
): Record<string, RealtimeToolHandler> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const { baseUrl } = options;

  return {
    search_docs: async (args) => {
      const data = await postVoiceJson<{ context?: string }>(
        resolveVoiceSearchUrl(baseUrl),
        { query: readStringArg(args, "query") },
        fetchImpl,
      );
      return data.context ?? "";
    },
    recall_user_memory: async (args, context) => {
      const data = await postVoiceJson<{ memories?: string }>(
        resolveVoiceMemorySearchUrl(baseUrl),
        { query: readStringArg(args, "query"), user_id: context.userId },
        fetchImpl,
      );
      return data.memories ?? "";
    },
    save_user_memory: async (args, context) => {
      await postVoiceJson(
        resolveVoiceMemorySaveUrl(baseUrl),
        { fact: readStringArg(args, "fact"), user_id: context.userId },
        fetchImpl,
      );
      return "Memory saved.";
    },
    get_design_data: async (_args, context) => {
      const data = await postVoiceJson<{ data?: unknown }>(
        resolveVoiceDesignDataUrl(baseUrl),
        { user_id: context.userId },
        fetchImpl,
      );
      return typeof data.data === "string" ? data.data : JSON.stringify(data.data ?? {});
    },
    get_financing_data: async (_args, context) => {
      const data = await postVoiceJson<{ data?: unknown }>(
        resolveVoiceFinancingDataUrl(baseUrl),
        { user_id: context.userId },
        fetchImpl,
      );
      return typeof data.data === "string" ? data.data : JSON.stringify(data.data ?? {});
    },
    show_visual_component: async (args) => {
      const componentType = readStringArg(args, "component_type") || "visual";
      return `Visual component ${componentType} acknowledged in chat-only mode.`;
    },
  };
}
