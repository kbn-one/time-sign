/**
 * The API: `GET /master_pk` and `GET /at/<date>`.
 *
 * A router of its own, because it is deployed on its own: Cloudflare serves the pages as static
 * assets and sends only {@link API_PATHS} to the Worker (`worker.ts`), which answers with this.
 * Locally `router.tsx` makes the same split.
 */

import { cors } from "remix/middleware/cors";
import { createRouter, type Middleware, type Router } from "remix/router";

import { routes } from "../client/routes.ts";

/**
 * The paths the API answers, as Cloudflare's `assets.runWorkerFirst` patterns: these reach the
 * Worker, everything else is a static file. `cloudflare.config.ts` lists the same (checked by
 * `router.test.ts`).
 */
export const API_PATHS = ["/master_pk", "/at/*"];

/** Whether a pathname belongs to the API, by {@link API_PATHS}. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/master_pk" || pathname.startsWith("/at/");
}

export type Bindings = {
  /** base64 encoded master public key */
  IBKEM_PUBLIC_KEY: string;
  /** base64 encoded master secret key */
  IBKEM_SECRET_KEY: string;
};

type ExtractUsk = (sk: Uint8Array, id: string) => Uint8Array;

const TEXT = { "content-type": "text/plain; charset=UTF-8" };

function notFound(): Response {
  return new Response("404 Not Found", { status: 404, headers: TEXT });
}

/**
 * A known path with an unsupported method is a 404, not fetch-router's 405,
 * and no response to `HEAD` carries a body.
 */
const notFoundAndHead: Middleware = async (context, next) => {
  let response = await next();
  if (response.status === 405) response = notFound();
  if (context.method === "HEAD" && response.body) {
    response = new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  return response;
};

/**
 * Percent-decodes a path segment, leaving any malformed escape as it is
 * (`2000-01-01%ZZ` stays `2000-01-01%ZZ` and is then an invalid date).
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch {
        return match;
      }
    });
  }
}

/** `/at/<one non-empty segment>`, matched on the raw pathname. */
const AT_PATH = /^\/at\/([^/]+)$/;

export function createApi(extract_usk: ExtractUsk, env: Bindings): Router {
  const router = createRouter({
    // CORS allows any origin on every path: both answers are public by design.
    middleware: [cors(), notFoundAndHead],
    // route-pattern will not match a segment with a malformed escape such as
    // `%ZZ`; it is still a (bad) date, so it gets the date route's 400.
    defaultHandler({ method, url }) {
      const match = url.pathname.match(AT_PATH);
      if (match && (method === "GET" || method === "HEAD")) {
        return atResponse(decodeSegment(match[1]));
      }
      return notFound();
    },
  });

  function atResponse(at: string): Response {
    const at_date = Date.parse(at);
    if (isNaN(at_date)) {
      return new Response("Invalid date", { status: 400, headers: TEXT });
    }
    if (Date.now() < at_date) {
      return new Response("It is not the time");
    }
    const sk = Uint8Array.fromBase64(env.IBKEM_SECRET_KEY);
    const usk = extract_usk(sk, at);
    return new Response(usk as Uint8Array<ArrayBuffer>);
  }

  router.get(
    routes.masterPk,
    () => new Response(Uint8Array.fromBase64(env.IBKEM_PUBLIC_KEY)),
  );

  router.get(routes.at, ({ url }) => {
    // The wildcard also matches `/at/a/b` and `/at/x/`; only a single segment
    // is a date. It is decoded from the raw pathname so that `%2F` and the
    // like decode exactly as they always have: the decoded string is the
    // identity the key is extracted for.
    const match = url.pathname.match(AT_PATH);
    if (!match) return notFound();
    return atResponse(decodeSegment(match[1]));
  });

  return router;
}
