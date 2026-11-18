/**
 * Response headers the static pages need, in one place: `router.tsx` sends them when it answers
 * live, and `cf_build.ts` writes them into the `_headers` file Cloudflare's static assets read.
 */

import { LANGS } from "../client/i18n.ts";
import { pagesFor } from "../client/routes.ts";

/**
 * The X player card's frame may be shown inside X (an HTTP header: `frame-ancestors` in a meta tag
 * is ignored). Nothing sets `X-Frame-Options`, which would block it.
 */
export const EMBED_HEADERS: Record<string, string> = {
  "content-security-policy":
    "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com",
};

/** Cloudflare's `_headers` file for the static build: every language's player frame. */
export function headersFile(): string {
  const lines: string[] = [];
  for (const lang of LANGS) {
    lines.push(pagesFor(lang).embed.href());
    for (const [name, value] of Object.entries(EMBED_HEADERS)) {
      lines.push(`  ${name}: ${value}`);
    }
  }
  return lines.join("\n") + "\n";
}
