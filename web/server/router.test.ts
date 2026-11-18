import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import config from "../../cloudflare.config.ts";
import { isMoment, parsePost, postHref, postMeta } from "../client/site.ts";
import { headersFile } from "./headers.ts";
import router, { entryPoints, WORKER_PATHS } from "./router.tsx";

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

Deno.test("Cloudflare sends exactly the Worker's paths to the Worker", () => {
  const worker = typeof config === "function" ? undefined : config.worker;
  assertEquals(worker?.assets?.runWorkerFirst, WORKER_PATHS);
});

const SITE = "https://time-sign.kbn.one";

function metaContent(html: string, key: string): string | undefined {
  const attr = key.startsWith("og:") ? "property" : "name";
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))
    ?.[1];
}

Deno.test("GET /post is the share page, with a player card", async () => {
  const res = await router.fetch(new Request("http://localhost/post"));
  assertEquals(res.status, 200);
  const html = await res.text();
  assertEquals(metaContent(html, "twitter:card"), "player");
  assertEquals(metaContent(html, "twitter:player"), `${SITE}/embed`);
  assertEquals(metaContent(html, "twitter:player:width"), "480");
  assertEquals(metaContent(html, "twitter:player:height"), "480");
  assertEquals(
    metaContent(html, "twitter:image"),
    `${SITE}/static/card.png`,
  );
  assertEquals(metaContent(html, "og:image"), `${SITE}/static/card.png`);
  assertStringIncludes(html, "/assets/islands/sealed_message");
  // The Worker rewrites these tags in the static file, so every one must be in it.
  for (const key of Object.keys(postMeta(null).tags)) {
    assert(metaContent(html, key) !== undefined, key);
  }
});

Deno.test("GET /post?t= names the moment in the card", async () => {
  const t = "2030-01-01T00:00:00Z";
  const html = await (await router.fetch(
    new Request(`http://localhost/post?t=${t}`),
  )).text();
  assertStringIncludes(
    html,
    "<title>A message sealed until 2030-01-01 00:00:00 UTC</title>",
  );
  assertEquals(metaContent(html, "twitter:player"), `${SITE}/embed?t=${t}`);
  // Not a moment the server issues keys for: the plain card.
  const plain = await (await router.fetch(
    new Request("http://localhost/post?t=2030-01-01"),
  )).text();
  assertEquals(metaContent(plain, "twitter:player"), `${SITE}/embed`);
});

Deno.test("GET /embed is frameable by X, bare and unindexed", async () => {
  const res = await router.fetch(new Request("http://localhost/embed?t=x"));
  assertEquals(res.status, 200);
  assertStringIncludes(
    res.headers.get("content-security-policy") ?? "",
    "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com",
  );
  assertEquals(res.headers.get("x-frame-options"), null);
  const html = await res.text();
  assertStringIncludes(html, '<meta name="robots" content="noindex"');
  assertStringIncludes(html, "/assets/islands/sealed_card");
  assert(!html.includes("<header"));
  assertStringIncludes(headersFile(), "/embed\n  content-security-policy: ");
});

Deno.test("GET /static/card.png is the square card image", async () => {
  const res = await router.fetch(
    new Request("http://localhost/static/card.png"),
  );
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "image/png");
  const png = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(png.buffer);
  assertEquals([view.getUint32(16), view.getUint32(20)], [675, 675]);
  assert(entryPoints.includes("/static/card.png"));
});

Deno.test("a /post link carries the moment in the query and the message in the fragment", () => {
  const ciphertext = crypto.getRandomValues(new Uint8Array(300));
  const href = postHref(SITE, "2030-01-01T00:00:00Z", ciphertext);
  const url = new URL(href);
  assertEquals(url.pathname + url.search, "/post?t=2030-01-01T00:00:00Z");
  assertEquals(
    parsePost(url.search, url.hash),
    { moment: "2030-01-01T00:00:00Z", ciphertext },
  );
  assert("error" in parsePost("?t=2030-01-01", url.hash));
  assert("error" in parsePost(url.search, ""));
  assert("error" in parsePost(url.search, "#c=***"));
  assert(isMoment("2030-01-01T00:00:10Z"));
  assert(!isMoment("2030-01-01T00:00:07Z"));
});
