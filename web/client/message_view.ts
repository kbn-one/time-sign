/**
 * A decrypted message as the page shows it: Markdown, drawn by `markdown.ts`.
 *
 * `markdown.ts` is loaded here by its URL, not by a module specifier the bundler can follow. Any
 * import the bundler sees — a dynamic one included — it records as the island's dependency, and the
 * renderer then writes a `<link rel="modulepreload">` for it into every page with an island. That
 * would fetch some 320 KB on page load to draw a message most visits never open.
 */

import type { RemixNode } from "remix/component";

/** Where `server/assets.ts` serves the `markdown.ts` entrypoint. */
export const MARKDOWN_SRC = "/assets/markdown.js";

type MarkdownModule = typeof import("./markdown.ts");

let markdown: Promise<MarkdownModule> | undefined;

export async function renderMessage(text: string): Promise<RemixNode> {
  const src: string = MARKDOWN_SRC;
  markdown ??= import(src) as Promise<MarkdownModule>;
  return (await markdown).renderMarkdown(text);
}
