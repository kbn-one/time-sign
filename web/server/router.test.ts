import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import config from "../../cloudflare.config.ts";
import router, { API_PATHS, entryPoints } from "./router.tsx";

Deno.test("GET / is the landing page", async () => {
  const res = await router.fetch(new Request("http://localhost/"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  assertStringIncludes(html, "<title>time-sign — time-lock encryption</title>");
  assertStringIncludes(html, 'href="/demo"');
  assertStringIncludes(html, "GET /master_pk");
  // No island on this page, so no runtime.
  assert(!html.includes('<script type="module"'));
  // The static crawl follows links, and must never reach the API.
  assert(!html.includes('href="/master_pk"'));
  assert(!html.includes('href="/at/'));
});

Deno.test("GET /demo places the demo island and boots the runtime", async () => {
  const res = await router.fetch(new Request("http://localhost/demo"));
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, '<script type="module" src="/assets/');
  assertStringIncludes(html, "/assets/islands/time_lock_demo");
  assertStringIncludes(html, "Seal message");
});

Deno.test("GET /time-sign.js serves the browser bundle of the client", async () => {
  const res = await router.fetch(new Request("http://localhost/time-sign.js"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "javascript");
  const js = await res.text();
  assertStringIncludes(js, "export");
  assertStringIncludes(js, "encrypt");
  assert(entryPoints.includes("/time-sign.js"));
});

Deno.test("GET /static/app.css", async () => {
  const res = await router.fetch(
    new Request("http://localhost/static/app.css"),
  );
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

Deno.test("Cloudflare sends exactly the API paths to the Worker", () => {
  const worker = typeof config === "function" ? undefined : config.worker;
  assertEquals(worker?.assets?.runWorkerFirst, API_PATHS);
});
