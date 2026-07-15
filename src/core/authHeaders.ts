/**
 * Merge `Authorization: Bearer <apiKey>` for backend-generac `/agents/*` calls.
 * Does not overwrite an existing Authorization header (e.g. from a custom `fetchImpl`).
 */
export function mergeChatAuthHeaders(
  apiKey: string | undefined,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  const key = apiKey?.trim();
  if (key && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  return headers;
}
