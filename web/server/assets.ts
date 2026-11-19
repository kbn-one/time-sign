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
  // `markdown.ts` is loaded by URL when a message is opened (`client/message_view.ts`), so it is
  // an entrypoint of the same graph rather than an import of the islands.
  entrypoints: ["hydration.ts", "islands/*.tsx", "markdown.ts"],
  basePath: assetsPath,
  mode: "bundle",
  bundle: { sourcemap: "none" },
});
