import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

const purify =
  typeof window !== "undefined"
    ? DOMPurify
    : (null as unknown as typeof DOMPurify);

let markedConfigured = false;

function configureMarkedLinks() {
  if (markedConfigured) return;
  markedConfigured = true;
  marked.use({
    renderer: {
      link(token) {
        const href = token.href;
        const title = token.title;
        const text = this.parser.parseInline(token.tokens);
        const t = title
          ? ` title="${String(title).replace(/"/g, "&quot;")}"`
          : "";
        return `<a target="_blank" rel="noopener noreferrer" href="${href}"${t}>${text}</a>`;
      },
    },
  });
}

export function useMarkedHtml(markdown: string): string {
  return useMemo(() => {
    configureMarkedLinks();
    const raw = marked.parse(markdown || "", { async: false }) as string;
    if (!purify) return raw;
    return purify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [markdown]);
}
