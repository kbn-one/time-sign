/**
 * The Cloudflare Workers entry: the API only.
 *
 * Cloudflare serves the static build (`web/dist`) as static assets and sends only the API paths
 * here, plus `/post` (`assets.runWorkerFirst` in `cloudflare.config.ts`). `/post` is the static
 * page with its card meta rewritten for the moment in `?t=`, so a crawler (X's, for the player
 * card) sees that moment without running any script.
 *
 * Workers can't compile Wasm from bytes at runtime, so the .wasm file is imported as a precompiled
 * `WebAssembly.Module` (a `wasm` module in the upload, arranged by `cf_build.ts`) and wired to the
 * wasmbuild glue by hand.
 */

// @ts-ignore: a `wasm` module of the Worker upload, not something Deno resolves
import wasmModule from "../../lib/rs_lib.wasm";
import * as glue from "../../lib/rs_lib.internal.js";
import { type Bindings, createApi } from "./api.ts";
import { routes } from "../client/routes.ts";
import { postMeta } from "../client/site.ts";

const instance = new WebAssembly.Instance(wasmModule as WebAssembly.Module, {
  "./rs_lib.internal.js": glue as unknown as WebAssembly.ModuleImports,
});
// deno-lint-ignore no-explicit-any
const exports = instance.exports as any;
glue.__wbg_set_wasm(exports);
exports.__wbindgen_start();

// The secrets arrive with the first request, and are the same for every request
// an isolate serves, so the router is built once from them.
let router: ReturnType<typeof createApi> | undefined;

/** The parts of the Workers runtime used here that Deno's types do not describe. */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
interface Element {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
}
declare class HTMLRewriter {
  on(selector: string, handlers: { element(element: Element): void }): this;
  transform(response: Response): Response;
}
const edgeCache = (caches as unknown as { default: Cache }).default;

type Env = Bindings & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

/** `/post`: the static page, its `<title>` and card meta written for `?t=`. */
async function post(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(
    new Request(new URL(routes.post.href(), url), request),
  );
  if (!page.ok) return page;
  const meta = postMeta(url.searchParams.get("t"));
  return new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(meta.title);
      },
    })
    .on("meta[name], meta[property]", {
      element(element) {
        const key = element.getAttribute("name") ??
          element.getAttribute("property");
        const content = key ? meta.tags[key] : undefined;
        if (content !== undefined) element.setAttribute("content", content);
      },
    })
    .transform(page);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (new URL(request.url).pathname === routes.post.href()) {
      return post(request, env);
    }
    router ??= createApi(glue.extract_usk, env);
    if (request.method !== "GET") return router.fetch(request);

    // Cloudflare does not cache what a Worker answers on its own, so the API keeps its public
    // answers (`cache-control: public, …`: redirects to a moment, keys for past moments, refusals
    // until the moment comes) in this data center's cache, and a key is extracted once per moment.
    const cached = await edgeCache.match(request);
    if (cached) return cached;
    const response = await router.fetch(request);
    if (response.headers.get("cache-control")?.startsWith("public")) {
      ctx.waitUntil(edgeCache.put(request, response.clone()));
    }
    return response;
  },
};
