// Cloudflare Workers entrypoint.
// Workers can't compile Wasm from bytes at runtime, so the .wasm file is
// imported as a precompiled WebAssembly.Module and wired to the wasmbuild glue.
// @ts-ignore: resolved by the Workers bundler (CompiledWasm module rule)
import wasmModule from "../lib/rs_lib.wasm";
import * as glue from "../lib/rs_lib.internal.js";
import { createApp } from "../app.ts";

const instance = new WebAssembly.Instance(wasmModule as WebAssembly.Module, {
  "./rs_lib.internal.js": glue as unknown as WebAssembly.ModuleImports,
});
// deno-lint-ignore no-explicit-any
const exports = instance.exports as any;
glue.__wbg_set_wasm(exports);
exports.__wbindgen_start();

export default createApp(glue.extract_usk);
