/**
 * The client runtime, started once per document on a page that places an island.
 *
 * `run()` finds the hydration markers the server rendered and hydrates each one, importing the
 * module the server named for it (`server/assets.ts` resolved those names to chunk URLs).
 */

import { run } from "remix/component";

const app = run({
  loadModule: async (moduleUrl, exportName) => {
    const module = await import(moduleUrl) as Record<string, unknown>;
    const picked = module[exportName];
    if (typeof picked !== "function") {
      throw new Error(
        `Module "${moduleUrl}" has no function export "${exportName}".`,
      );
    }
    return picked;
  },
});

await app.ready();

(globalThis as unknown as { __rmxReady?: boolean }).__rmxReady = true;
