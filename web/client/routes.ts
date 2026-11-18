/**
 * Every URL the site answers, in one place.
 *
 * Two kinds of route live here and they are deployed differently:
 *
 * - **Pages and files** (`home`, `demo`, `post`, `embed`, `lib`, `static`) are rendered to static
 *   files by `deno task build` and served by Cloudflare as static assets. `post` also passes
 *   through the Worker, which writes the moment from `?t=` into its card meta tags.
 * - **The API** (`masterPk`, `at`) is answered by the Worker (`server/worker.ts`). Nothing links to
 *   it, so the static build never reaches it; pages name it by `routes.masterPk.href()`.
 *   `cloudflare.config.ts` sends exactly these paths to the Worker (`API_PATHS` in
 *   `server/api.ts`, checked by `server/router.test.ts`).
 */

import { get, route } from "remix/routes";

export const routes = route({
  home: get("/"),
  demo: get("/demo"),
  /** A sealed message to share: `/post?t=<moment>#c=<ciphertext>`. The Worker fills in its card. */
  post: get("/post"),
  /** The X player card's iframe for a post: `/embed?t=<moment>`. */
  embed: get("/embed"),
  /** `client/mod.ts` bundled for the browser (`deno task build:lib`), wasm inlined. */
  lib: get("/time-sign.js"),
  static: get("/static/*path"),
  masterPk: get("/master_pk"),
  // A wildcard rather than `:at`: a route-pattern param stops at `.`, and a
  // date such as `2000-01-01T00:00:00.000Z` has to reach the handler whole.
  at: get("/at/*at"),
});
