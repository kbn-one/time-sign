/**
 * Cloudflare deployment config, read by the `cf` CLI (`deno task cf deploy --prebuilt`).
 *
 * Cloudflare serves the static build (`web/dist`) as Workers static assets and runs only the API in
 * the Worker (`web/server/worker.ts`, bundled to `web/worker-dist/worker.js`). `deno task build:cf`
 * makes both and arranges them for `--prebuilt`.
 */

import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "time-sign",
    compatibilityDate: "2026-10-01",
    entrypoint: "./web/worker-dist/worker.js",
    domains: ["time-sign.kbn.one"],
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "none",
      // Only these reach the Worker — the API, and /post for its card meta;
      // every other path is a static file. Keep in step with `WORKER_PATHS` in
      // web/server/api.ts (checked by web/server/router.test.ts).
      runWorkerFirst: ["/master_pk", "/at/*", "/post"],
    },
    env: {
      // The static build, for /post: the Worker serves it with its meta rewritten.
      ASSETS: bindings.assets(),
      // Both are generated in CI by .github/workflows/keygen.yml
      IBKEM_PUBLIC_KEY: bindings.secret(),
      IBKEM_SECRET_KEY: bindings.secret(),
    },
  },
});
