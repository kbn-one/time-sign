import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import config from "../../cloudflare.config.ts";
import {
  CARD_TEMPLATE,
  isMoment,
  parsePost,
  POST_META,
  shareHref,
} from "../client/site.ts";
import { headersFile } from "./headers.ts";
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

const SITE = "https://time-sign.kbn.one";

function metaContent(html: string, key: string): string | undefined {
  const attr = key.startsWith("og:") ? "property" : "name";
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))
    ?.[1];
}

Deno.test("GET /post is one page for every link, with a plain card", async () => {
  for (const path of ["/post", "/post?t=2030-01-01T00:00:00Z&c=AAAA"]) {
    const res = await router.fetch(new Request(`http://localhost${path}`));
    assertEquals(res.status, 200);
    const html = await res.text();
    assertStringIncludes(html, `<title>${POST_META.title}</title>`);
    for (const [key, content] of Object.entries(POST_META.tags)) {
      assertEquals(metaContent(html, key), content, key);
    }
    assertStringIncludes(html, "/assets/islands/sealed_message");
  }
});

Deno.test("static/og-card.svg is og.kbn.one's template: player and reader get #c=", async () => {
  const res = await router.fetch(
    new Request("http://localhost/static/og-card.svg"),
  );
  assertEquals(res.status, 200);
  const svg = await res.text();
  const json = svg.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1];
  const config = JSON.parse(json ?? "null");
  assertEquals(config.url, `${SITE}/post?t={{t}}#c={{c}}`);
  assertEquals(config.player.url, `${SITE}/embed?t={{t}}#c={{c}}`);
  assertEquals([config.player.width, config.player.height], [480, 480]);
  assertStringIncludes(svg, "{{when}}");
  assert(entryPoints.includes("/static/og-card.svg"));
  assertEquals(CARD_TEMPLATE, "time-sign.kbn.one/static/og-card.svg");
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

Deno.test("share links: private on this site after #, X cards through og.kbn.one", () => {
  const moment = "2030-01-01T00:00:00Z";
  const ciphertext = crypto.getRandomValues(new Uint8Array(300));
  const c = ciphertext.toBase64({ alphabet: "base64url", omitPadding: true });

  const priv = new URL(shareHref(SITE, moment, ciphertext));
  assertEquals(
    priv.origin + priv.pathname + priv.search,
    `${SITE}/post?t=${moment}`,
  );
  assertEquals(parsePost(priv.search, priv.hash), { moment, ciphertext });

  const card = new URL(shareHref(SITE, moment, ciphertext, "card"));
  assertEquals(card.origin + card.pathname, "https://og.kbn.one/share");
  assertEquals(card.searchParams.get("tmpl"), CARD_TEMPLATE);
  assertEquals(card.searchParams.get("t"), moment);
  assertEquals(card.searchParams.get("when"), "2030-01-01 00:00:00 UTC");
  assertEquals(card.searchParams.get("c"), c);
  // What og.kbn.one sends the reader and the player to: the ciphertext after #.
  const dest = new URL(`${SITE}/post?t=${encodeURIComponent(moment)}#c=${c}`);
  assertEquals(parsePost(dest.search, dest.hash), { moment, ciphertext });

  assert("error" in parsePost("?t=2030-01-01", priv.hash));
  assert("error" in parsePost(priv.search, ""));
  assert("error" in parsePost(priv.search, "#c=***"));
  assert(isMoment("2030-01-01T00:00:10Z"));
  assert(!isMoment("2030-01-01T00:00:07Z"));
});
