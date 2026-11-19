/**
 * Response headers the static pages need, in one place: `router.tsx` sends them when it answers
 * live, and `cf_build.ts` writes them into the `_headers` file Cloudflare's static assets read.
 */

import { LANGS } from "../client/i18n.ts";
import { pagesFor, routes } from "../client/routes.ts";

/**
 * The X player card's frame may be shown inside X (an HTTP header: `frame-ancestors` in a meta tag
 * is ignored). Nothing sets `X-Frame-Options`, which would block it.
 */
export const EMBED_HEADERS: Record<string, string> = {
  "content-security-policy":
    "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com",
};

/**
 * The client bundle may be imported from any site: a module script from another origin loads only
 * with CORS, as the API answers with it.
 */
export const LIB_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
};

/**
 * Cloudflare's `_headers` file for the static build: every language's player frame, and the client
 * bundle.
 */
export function headersFile(): string {
  const lines: string[] = [routes.lib.href()];
  for (const [name, value] of Object.entries(LIB_HEADERS)) {
    lines.push(`  ${name}: ${value}`);
  }
  for (const lang of LANGS) {
    lines.push(pagesFor(lang).embed.href());
    for (const [name, value] of Object.entries(EMBED_HEADERS)) {
      lines.push(`  ${name}: ${value}`);
    }
  }
  return lines.join("\n") + "\n";
}
