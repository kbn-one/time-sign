import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import config from "../../cloudflare.config.ts";
import { formatMoment, LANGS, timeZoneLabel } from "../client/i18n.ts";
import {
  CARD_TEMPLATES,
  isMoment,
  parsePost,
  postMeta,
  shareHref,
} from "../client/site.ts";
import { headersFile } from "./headers.ts";
import router, { API_PATHS, entryPoints } from "./router.tsx";

Deno.test("GET / is the landing page in Japanese, /en in English", async () => {
  const pages: [string, string, string, string][] = [
    ["/", "ja", "<title>time-sign — 時限暗号</title>", 'href="/demo"'],
    [
      "/en",
      "en",
      "<title>time-sign — time-lock encryption</title>",
      'href="/en/demo"',
    ],
  ];
  for (const [path, lang, title, demoLink] of pages) {
    const res = await router.fetch(new Request(`http://localhost${path}`));
    assertEquals(res.status, 200, path);
    assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
    const html = await res.text();
    assertStringIncludes(html, `<html lang="${lang}">`);
    assertStringIncludes(html, title);
    assertStringIncludes(html, demoLink);
    assertStringIncludes(html, "GET /master_pk");
    // Both languages, for search engines, and a switch to the other one.
    assertStringIncludes(
      html,
      '<link rel="alternate" hreflang="ja" href="https://time-sign.kbn.one/"',
    );
    assertStringIncludes(
      html,
      '<link rel="alternate" hreflang="en" href="https://time-sign.kbn.one/en"',
    );
    assertStringIncludes(html, lang === "ja" ? 'href="/en"' : 'href="/"');
    // No island on this page, so no runtime.
    assert(!html.includes('<script type="module"'));
    // The static crawl follows links, and must never reach the API.
    assert(!html.includes('href="/master_pk"'));
    assert(!html.includes('href="/at/'));
  }
});

Deno.test("GET /demo and /en/demo place the demo island in their language", async () => {
  for (
    const [path, lang, seal] of [["/demo", "ja", "封をする"], [
      "/en/demo",
      "en",
      "Seal message",
    ]]
  ) {
    const res = await router.fetch(new Request(`http://localhost${path}`));
    assertEquals(res.status, 200, path);
    const html = await res.text();
    assertStringIncludes(html, `<html lang="${lang}">`);
    assertStringIncludes(html, '<script type="module" src="/assets/');
    assertStringIncludes(html, "/assets/islands/time_lock_demo");
    assertStringIncludes(html, seal);
  }
});

Deno.test("a moment is said in the reader's time zone, abbreviated", () => {
  const moment = "2026-11-18T05:00:00Z";
  assertEquals(
    formatMoment(moment, "ja", "Asia/Tokyo"),
    "2026/11/18 14:00:00 JST",
  );
  assertEquals(
    formatMoment(moment, "en", "Asia/Tokyo"),
    "Nov 18, 2026, 2:00:00 PM GMT+9",
  );
  assertEquals(
    formatMoment(moment, "en", "America/New_York"),
    "Nov 18, 2026, 12:00:00 AM EST",
  );
  assertEquals(timeZoneLabel("ja", "Asia/Tokyo"), "JST (Asia/Tokyo)");
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

Deno.test("GET /post and /en/post are one page for every link, with a plain card", async () => {
  for (const lang of LANGS) {
    const base = lang === "ja" ? "/post" : "/en/post";
    const meta = postMeta(lang);
    for (const path of [base, `${base}?t=2030-01-01T00:00:00Z&c=AAAA`]) {
      const res = await router.fetch(new Request(`http://localhost${path}`));
      assertEquals(res.status, 200, path);
      const html = await res.text();
      assertStringIncludes(html, `<html lang="${lang}">`);
      assertStringIncludes(html, `<title>${meta.title}</title>`);
      for (const [key, content] of Object.entries(meta.tags)) {
        assertEquals(metaContent(html, key), content, key);
      }
      assertStringIncludes(html, "/assets/islands/sealed_message");
    }
  }
});

Deno.test("og.kbn.one's templates send player and reader to their language, with #c=", async () => {
  const expected = [
    ["og-card.svg", "", "まで封印"],
    ["og-card-en.svg", "/en", "Sealed until"],
  ];
  for (const [file, prefix, text] of expected) {
    const res = await router.fetch(
      new Request(`http://localhost/static/${file}`),
    );
    assertEquals(res.status, 200, file);
    const svg = await res.text();
    const json = svg.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1];
    const config = JSON.parse(json ?? "null");
    assertEquals(config.url, `${SITE}${prefix}/post?t={{t}}#c={{c}}`, file);
    assertEquals(
      config.player.url,
      `${SITE}${prefix}/embed?t={{t}}#c={{c}}`,
      file,
    );
    assertEquals([config.player.width, config.player.height], [480, 480]);
    assertStringIncludes(svg, "{{when}}");
    assertStringIncludes(svg, text);
    assert(entryPoints.includes(`/static/${file}`));
  }
  assertEquals(CARD_TEMPLATES.ja, "time-sign.kbn.one/static/og-card.svg");
  assertEquals(CARD_TEMPLATES.en, "time-sign.kbn.one/static/og-card-en.svg");
});

Deno.test("GET /embed and /en/embed are frameable by X, bare and unindexed", async () => {
  for (const path of ["/embed", "/en/embed"]) {
    const res = await router.fetch(new Request(`http://localhost${path}?t=x`));
    assertEquals(res.status, 200, path);
    assertStringIncludes(
      res.headers.get("content-security-policy") ?? "",
      "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com",
    );
    assertEquals(res.headers.get("x-frame-options"), null);
    const html = await res.text();
    assertStringIncludes(html, '<meta name="robots" content="noindex"');
    assertStringIncludes(html, "/assets/islands/sealed_card");
    assert(!html.includes("<header"));
    assertStringIncludes(headersFile(), `${path}\n  content-security-policy: `);
  }
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

  const priv = new URL(shareHref(SITE, moment, ciphertext, "private", "ja"));
  assertEquals(
    priv.origin + priv.pathname + priv.search,
    `${SITE}/post?t=${moment}`,
  );
  assertEquals(parsePost(priv.search, priv.hash), { moment, ciphertext });

  // The card says the moment as the sharer reads it.
  const card = new URL(
    shareHref(SITE, moment, ciphertext, "card", "ja", "Asia/Tokyo"),
  );
  assertEquals(card.origin + card.pathname, "https://og.kbn.one/share");
  assertEquals(card.searchParams.get("tmpl"), CARD_TEMPLATES.ja);
  assertEquals(card.searchParams.get("t"), moment);
  assertEquals(card.searchParams.get("when"), "2030/01/01 9:00:00 JST");
  assertEquals(card.searchParams.get("c"), c);
  // What og.kbn.one sends the reader and the player to: the ciphertext after #.
  const dest = new URL(`${SITE}/post?t=${encodeURIComponent(moment)}#c=${c}`);
  assertEquals(parsePost(dest.search, dest.hash), { moment, ciphertext });

  const enPriv = new URL(shareHref(SITE, moment, ciphertext, "private", "en"));
  assertEquals(enPriv.pathname, "/en/post");
  const enCard = new URL(
    shareHref(SITE, moment, ciphertext, "card", "en", "America/New_York"),
  );
  assertEquals(enCard.searchParams.get("tmpl"), CARD_TEMPLATES.en);
  assertEquals(
    enCard.searchParams.get("when"),
    "Dec 31, 2029, 7:00:00 PM EST",
  );

  assert("error" in parsePost("?t=2030-01-01", priv.hash));
  assert("error" in parsePost(priv.search, ""));
  assert("error" in parsePost(priv.search, "#c=***"));
  assert(isMoment("2030-01-01T00:00:10Z"));
  assert(!isMoment("2030-01-01T00:00:07Z"));
});
