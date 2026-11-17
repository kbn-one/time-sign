// Cloudflare Workers entrypoint.
// Workers can't compile Wasm from bytes at runtime, so the .wasm file is
// imported as a precompiled WebAssembly.Module and wired to the wasmbuild glue.
// @ts-ignore: resolved by the Workers bundler (CompiledWasm module rule)
import wasmModule from "../lib/rs_lib.wasm";
import * as glue from "../lib/rs_lib.internal.js";
import { type Bindings, createApp } from "../router.ts";

const instance = new WebAssembly.Instance(wasmModule as WebAssembly.Module, {
  "./rs_lib.internal.js": glue as unknown as WebAssembly.ModuleImports,
});
// deno-lint-ignore no-explicit-any
const exports = instance.exports as any;
glue.__wbg_set_wasm(exports);
exports.__wbindgen_start();

// The secrets arrive with the first request, and are the same for every request
// an isolate serves, so the router is built once from them.
let router: ReturnType<typeof createApp> | undefined;

export default {
  fetch(request: Request, env: Bindings): Promise<Response> {
    router ??= createApp(glue.extract_usk, env);
    return router.fetch(request);
  },
};
