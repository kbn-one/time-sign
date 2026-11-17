// Pins the HTTP behaviour the service had on Hono: paths, status codes, bodies
// and headers, including the corners (404 rather than 405, dates containing
// `.` or escapes). CORS is the one deliberate change: Hono only answered it on
// `/`; now every path allows any origin.
import { assertEquals } from "@std/assert";
import { createApi } from "./api.ts";
import { decrypt, encrypt } from "../../client/mod.ts";
import { extract_usk, setup } from "../../lib/rs_lib.js";

const [pk, sk]: [string, string] = setup();
const router = createApi(extract_usk, {
  IBKEM_PUBLIC_KEY: pk,
  IBKEM_SECRET_KEY: sk,
});
const TEXT = "text/plain; charset=UTF-8";
const ORIGIN = { Origin: "https://example.com" };

function req(path: string, init?: RequestInit) {
  return router.fetch(new Request("http://localhost" + path, init));
}

async function expectText(
  res: Response,
  status: number,
  body: string,
  headers: [string, string][],
) {
  assertEquals(res.status, status);
  assertEquals([...res.headers], headers);
  assertEquals(await res.text(), body);
}

Deno.test("every path answers a CORS preflight for any origin", async () => {
  for (const path of ["/master_pk", "/at/2000-01-01", "/nope"]) {
    const res = await req(path, {
      method: "OPTIONS",
      headers: { ...ORIGIN, "Access-Control-Request-Method": "GET" },
    });
    assertEquals(res.status, 204, path);
    assertEquals(res.headers.get("access-control-allow-origin"), "*", path);
    assertEquals(
      res.headers.get("access-control-allow-methods")?.includes("GET"),
      true,
      path,
    );
  }
});

Deno.test("every path allows any origin", async () => {
  for (
    const path of ["/master_pk", "/at/2000-01-01", "/at/2999-01-01", "/nope"]
  ) {
    const res = await req(path, { headers: ORIGIN });
    await res.body?.cancel();
    assertEquals(res.headers.get("access-control-allow-origin"), "*", path);
  }
});

Deno.test("GET /master_pk returns the raw public key", async () => {
  const res = await req("/master_pk");
  assertEquals(res.status, 200);
  assertEquals([...res.headers], []);
  assertEquals(
    new Uint8Array(await res.arrayBuffer()),
    Uint8Array.fromBase64(pk),
  );
});

Deno.test("GET /at/<future> is not the time yet", async () => {
  await expectText(
    await req("/at/2999-01-01"),
    200,
    "It is not the time",
    [["content-type", "text/plain;charset=UTF-8"]],
  );
});

Deno.test("GET /at/<invalid> is 400", async () => {
  for (const path of ["/at/foo", "/at/%ZZ", "/at/2000-01-01.json"]) {
    await expectText(await req(path), 400, "Invalid date", [
      ["content-type", TEXT],
    ]);
  }
});

Deno.test("GET /at/<past> returns a key that decrypts for that date", async () => {
  const cases: [string, string][] = [
    ["/at/2000-01-01", "2000-01-01"],
    ["/at/2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z"],
    ["/at/2000-01-01%2000:00", "2000-01-01 00:00"],
    ["/at/2000%2F01%2F01", "2000/01/01"],
  ];
  const plain = new TextEncoder().encode("秘密");
  for (const [path, id] of cases) {
    const enc = await encrypt(Uint8Array.fromBase64(pk), id, plain);
    const res = await req(path);
    assertEquals(res.status, 200, path);
    assertEquals([...res.headers], [], path);
    const usk = new Uint8Array(await res.arrayBuffer());
    assertEquals(new Uint8Array(await decrypt(usk, enc)), plain, path);
  }
});

Deno.test("unknown paths and methods are 404", async () => {
  const notFound: [string, string][] = [["content-type", TEXT]];
  for (
    const path of ["/nope", "/at", "/at/", "/at/2000-01-01/x", "/master_pk/"]
  ) {
    await expectText(await req(path), 404, "404 Not Found", notFound);
  }
  await expectText(
    await req("/master_pk", { method: "POST" }),
    404,
    "404 Not Found",
    notFound,
  );
  await expectText(
    await req("/at/2000-01-01", { method: "POST" }),
    404,
    "404 Not Found",
    notFound,
  );
});

Deno.test("HEAD answers like GET without a body", async () => {
  const ok = await req("/master_pk", { method: "HEAD" });
  assertEquals(ok.status, 200);
  assertEquals(await ok.text(), "");
  const missing = await req("/nope", { method: "HEAD" });
  assertEquals(missing.status, 404);
  assertEquals(await missing.text(), "");
});
