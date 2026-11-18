/**
 * The API: `GET /master_pk` and `GET /at/<date>`.
 *
 * `/at/<date>` issues keys every 10 seconds only, for one spelling of the moment (`timeId` in
 * `client/time_id.ts`, rounded up): any other spelling is a `301` to it. So every request for a
 * moment lands on one URL, and its answer can be cached — the key for a past moment for good, the
 * refusal for a future one until the moment comes.
 *
 * A router of its own, because it is deployed on its own: Cloudflare serves the pages as static
 * assets and sends only {@link API_PATHS} to the Worker (`worker.ts`), which answers with this.
 * Locally `router.tsx` makes the same split.
 */

import { cors } from "remix/middleware/cors";
import { createRouter, type Middleware, type Router } from "remix/router";

import { timeId } from "../../client/time_id.ts";
import { routes } from "../client/routes.ts";

/**
 * The paths the API answers, as Cloudflare's `assets.runWorkerFirst` patterns.
 */
export const API_PATHS = ["/master_pk", "/at/*"];

/**
 * Every path Cloudflare sends to the Worker (`assets.runWorkerFirst` in `cloudflare.config.ts`):
 * the API, and `/post`, whose card the Worker fills in for the moment in `?t=` (`worker.ts`).
 */
export const WORKER_PATHS = [...API_PATHS, "/post"];

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

/** For answers that never change: a redirect to a moment's identity, the key for a past one. */
const IMMUTABLE = "public, max-age=31536000, immutable";

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
 * `Access-Control-Allow-Origin: *` on every response, whether or not the request carried an
 * `Origin`. `cors()` only answers requests that do, and a cached response has to be right for
 * whoever it is served to next.
 */
const allowAnyOrigin: Middleware = async (_context, next) => {
  const response = await next();
  if (response.headers.has("access-control-allow-origin")) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
    middleware: [allowAnyOrigin, cors(), notFoundAndHead],
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
    const id = timeId(at_date);
    if (at !== id) {
      return new Response(null, {
        status: 301,
        headers: { location: `/at/${id}`, "cache-control": IMMUTABLE },
      });
    }
    const wait = at_date - Date.now();
    if (wait > 0) {
      return new Response("It is not the time", {
        headers: {
          "cache-control": `public, max-age=${Math.ceil(wait / 1000)}`,
        },
      });
    }
    const sk = Uint8Array.fromBase64(env.IBKEM_SECRET_KEY);
    const usk = extract_usk(sk, id);
    return new Response(usk as Uint8Array<ArrayBuffer>, {
      headers: { "cache-control": IMMUTABLE },
    });
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
