import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "time-sign",
    compatibilityDate: "2026-10-01",
    // bundled by `deno task build:worker`
    entrypoint: "dist/worker.js",
    domains: ["time-sign.kbn.one"],
    env: {
      // Both are generated in CI by .github/workflows/keygen.yml
      IBKEM_PUBLIC_KEY: bindings.secret(),
      IBKEM_SECRET_KEY: bindings.secret(),
    },
  },
});
