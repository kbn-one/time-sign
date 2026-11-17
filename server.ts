// Local server for Deno: `deno task server`
import { createApp } from "./router.ts";
import { extract_usk } from "./lib/rs_lib.js";

const router = createApp(extract_usk, {
  IBKEM_PUBLIC_KEY: Deno.env.get("IBKEM_PUBLIC_KEY")!,
  IBKEM_SECRET_KEY: Deno.env.get("IBKEM_SECRET_KEY")!,
});

export default {
  fetch: (req: Request) => router.fetch(req),
} satisfies Deno.ServeDefaultExport;
