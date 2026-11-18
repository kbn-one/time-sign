/**
 * Writes the Cloudflare Build Output Specification (`.cloudflare/output/v0`) for `cf deploy
 * --prebuilt`.
 *
 * `cf build` delegates to Wrangler or the Vite plugin, neither of which resolves this repo's `jsr:`
 * imports. So the Worker is bundled by `deno bundle` (`deno task build:worker`) and the static site
 * by `deno task build`; this script arranges those two outputs the way `cf` reads them, with the
 * settings from `cloudflare.config.ts`.
 *
 * The one addition to the template's version is the Wasm module: the bundle keeps
 * `import … from "../../lib/rs_lib.wasm"` external, so the file is copied beside `worker.js`, the
 * import is pointed at it, and it is declared a `wasm` module — which Workers hand to the code as
 * a compiled `WebAssembly.Module`.
 *
 * Run it through `deno task build:cf`, which builds both inputs first.
 */

import {
  cleanBuildOutputDir,
  getWorkerBundleDir,
  writeAssets,
  writeRootConfig,
  writeWorkerConfig,
} from "@cloudflare/build-output-utils";
import {
  loadAndParseConfig,
  loadAndParseConfigSettings,
} from "@cloudflare/config";

import { headersFile } from "./headers.ts";

const root = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const workerPath = `${root}web/worker-dist/worker.js`;
const wasmPath = `${root}lib/rs_lib.wasm`;
const WASM_SPECIFIER = "../../lib/rs_lib.wasm";
const WASM_MODULE = "rs_lib.wasm";
const ctx = { isPreview: false, mode: Deno.args[0] };

const configPath = `${root}cloudflare.config.ts`;
const { result } = await loadAndParseConfig(configPath, ctx);
if (!result.success) throw new Error(`cloudflare.config.ts: ${result.error}`);
const config = result.data.worker;
if (!config) throw new Error("cloudflare.config.ts has no `worker`");
const { result: settings } = await loadAndParseConfigSettings(configPath, ctx);
if (!settings.success) {
  throw new Error(`cloudflare.config.ts: ${settings.error}`);
}

const worker = await Deno.readTextFile(workerPath);
const quoted = JSON.stringify(WASM_SPECIFIER);
if (!worker.includes(quoted)) {
  throw new Error(`${workerPath} does not import ${quoted}`);
}

// Response headers for the static files (the X player's `frame-ancestors`), in the file Workers
// static assets read them from.
await Deno.writeTextFile(`${root}web/dist/_headers`, headersFile());

await cleanBuildOutputDir(root);
await writeRootConfig(root, settings.data, ctx);
await writeAssets({ root, sourceDirectory: `${root}web/dist` });

const bundleDir = getWorkerBundleDir(root);
await Deno.mkdir(bundleDir, { recursive: true });
await Deno.writeTextFile(
  `${bundleDir}/worker.js`,
  worker.replaceAll(quoted, JSON.stringify(`./${WASM_MODULE}`)),
);
await Deno.copyFile(wasmPath, `${bundleDir}/${WASM_MODULE}`);
await writeWorkerConfig({
  root,
  config,
  manifest: {
    type: "complete",
    mainModule: "worker.js",
    modules: {
      "worker.js": { type: "esm" },
      [WASM_MODULE]: { type: "wasm" },
    },
  },
});
console.log("Wrote .cloudflare/output/v0");
