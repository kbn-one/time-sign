/**
 * The browser modules, compiled as one code-split graph by `Deno.bundle`.
 *
 * The client runtime and every island are entrypoints of one bundle, so a module two of them import
 * (the Remix runtime) is emitted once into a shared chunk.
 */

import { createAssetServer } from "@remix-kbn/assets-deno";

const clientDir = new URL("../client/", import.meta.url);

/** Where the chunks are served. */
export const assetsPath = "/assets";

export const assets = await createAssetServer({
  rootDir: decodeURIComponent(clientDir.pathname),
  entrypoints: ["hydration.ts", "islands/*.tsx"],
  basePath: assetsPath,
  mode: "bundle",
  bundle: { sourcemap: "none" },
});
