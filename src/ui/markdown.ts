import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { marked } from "marked";
import { useMemo } from "react";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

const purify =
  typeof window !== "undefined"
    ? DOMPurify
    : (null as unknown as typeof DOMPurify);

let markedConfigured = false;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function configureMarked() {
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
      code(token) {
        const code = token.text;
        const rawLang = token.lang?.trim().split(/\s/)[0] ?? "";
        const lang = rawLang.replace(/^language-/, "");
        try {
          if (lang && hljs.getLanguage(lang)) {
            const highlighted = hljs.highlight(code, {
              language: lang,
              ignoreIllegals: true,
            }).value;
            return `<pre class="sunny-chat-md-pre"><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>`;
          }
          const { value } = hljs.highlightAuto(code, [
            "typescript",
            "javascript",
            "json",
            "bash",
            "css",
            "xml",
            "markdown",
          ]);
          return `<pre class="sunny-chat-md-pre"><code class="hljs">${value}</code></pre>`;
        } catch {
          return `<pre class="sunny-chat-md-pre"><code>${escapeHtml(code)}</code></pre>`;
        }
      },
    },
  });
}

export function useMarkedHtml(markdown: string): string {
  return useMemo(() => {
    configureMarked();
    const raw = marked.parse(markdown || "", { async: false }) as string;
    if (!purify) return raw;
    return purify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [markdown]);
}
