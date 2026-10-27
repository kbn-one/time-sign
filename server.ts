// Local server for Deno: `deno task server`
import { createApp } from "./app.ts";
import { extract_usk } from "./lib/rs_lib.js";

const app = createApp(extract_usk);
const env = {
  IBKEM_PUBLIC_KEY: Deno.env.get("IBKEM_PUBLIC_KEY")!,
  IBKEM_SECRET_KEY: Deno.env.get("IBKEM_SECRET_KEY")!,
};

export default {
  fetch: (req: Request) => app.fetch(req, env),
} satisfies Deno.ServeDefaultExport;
