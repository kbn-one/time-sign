/**
 * The Cloudflare Workers entry: the API only.
 *
 * Cloudflare serves the static build (`web/dist`) as static assets and sends only the API paths
 * here (`assets.runWorkerFirst` in `cloudflare.config.ts`).
 *
 * Workers can't compile Wasm from bytes at runtime, so the .wasm file is imported as a precompiled
 * `WebAssembly.Module` (a `wasm` module in the upload, arranged by `cf_build.ts`) and wired to the
 * wasmbuild glue by hand.
 */

// @ts-ignore: a `wasm` module of the Worker upload, not something Deno resolves
import wasmModule from "../../lib/rs_lib.wasm";
import * as glue from "../../lib/rs_lib.internal.js";
import { type Bindings, createApi } from "./api.ts";

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
const edgeCache = (caches as unknown as { default: Cache }).default;

export default {
  async fetch(
    request: Request,
    env: Bindings,
    ctx: ExecutionContext,
  ): Promise<Response> {
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
