/**
 * Every URL the site answers, in one place.
 *
 * Two kinds of route live here and they are deployed differently:
 *
 * - **Pages and files** (`home`, `demo`, `post`, `embed` — in Japanese at the top, in English under
 *   `en` — and `lib`, `static`) are rendered to static files by `deno task build` and served by
 *   Cloudflare as static assets. `pagesFor(lang)` picks a language's pages.
 * - **The API** (`masterPk`, `at`) is answered by the Worker (`server/worker.ts`). Nothing links to
 *   it, so the static build never reaches it; pages name it by `routes.masterPk.href()`.
 *   `cloudflare.config.ts` sends exactly these paths to the Worker (`API_PATHS` in
 *   `server/api.ts`, checked by `server/router.test.ts`).
 */

import { get, route } from "remix/routes";

import type { Lang } from "./i18n.ts";

export const routes = route({
  home: get("/"),
  demo: get("/demo"),
  /** A sealed message to share: `/post?t=<moment>#c=<ciphertext>`. */
  post: get("/post"),
  /** The X player card's iframe for a post: `/embed?t=<moment>#c=<ciphertext>`. */
  embed: get("/embed"),
  /** The same pages in English. */
  en: route("en", {
    home: get("/"),
    demo: get("/demo"),
    post: get("/post"),
    embed: get("/embed"),
  }),
  /** `client/mod.ts` bundled for the browser (`deno task build:lib`), wasm inlined. */
  lib: get("/time-sign.js"),
  static: get("/static/*path"),
  masterPk: get("/master_pk"),
  // A wildcard rather than `:at`: a route-pattern param stops at `.`, and a
  // date such as `2000-01-01T00:00:00.000Z` has to reach the handler whole.
  at: get("/at/*at"),
});

/** A language's pages. */
export function pagesFor(lang: Lang) {
  return lang === "ja"
    ? {
      home: routes.home,
      demo: routes.demo,
      post: routes.post,
      embed: routes.embed,
    }
    : routes.en;
}

/** The names of the pages every language has. */
export type PageName = "home" | "demo" | "post" | "embed";
