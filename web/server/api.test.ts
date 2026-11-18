// The API's HTTP behaviour: paths, status codes, bodies and headers, including
// the corners (404 rather than 405, dates containing `.` or escapes). Every
// response allows any origin; `/at/` answers only for a moment on the 10 s step
// (`timeId`) and redirects every other spelling there.
import { assert, assertEquals, assertThrows } from "@std/assert";
import { createApi } from "./api.ts";
import { decrypt, encrypt, timeId } from "../../client/mod.ts";
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
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    [...res.headers].filter(([name]) => name !== "access-control-allow-origin"),
    headers,
  );
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
  assertEquals([...res.headers], [["access-control-allow-origin", "*"]]);
  assertEquals(
    new Uint8Array(await res.arrayBuffer()),
    Uint8Array.fromBase64(pk),
  );
});

Deno.test("GET /at/<future> is not the time yet, cacheable until then", async () => {
  const at = Date.now() + 3_600_000;
  const id = timeId(at);
  const res = await req(`/at/${id}`);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/plain;charset=UTF-8");
  const maxAge = Number(
    res.headers.get("cache-control")?.match(/^public, max-age=(\d+)$/)?.[1],
  );
  const wait = (Date.parse(id) - Date.now()) / 1000;
  assert(Math.abs(maxAge - wait) < 2, `max-age ${maxAge}, wait ${wait}`);
  assertEquals(await res.text(), "It is not the time");
});

Deno.test("GET /at/<invalid> is 400", async () => {
  for (const path of ["/at/foo", "/at/%ZZ", "/at/2000-01-01.json"]) {
    await expectText(await req(path), 400, "Invalid date", [
      ["content-type", TEXT],
    ]);
  }
});

Deno.test("GET /at/<any other spelling> redirects to the moment rounded up to 10 s", async () => {
  const cases: [string, string][] = [
    ["/at/2000-01-01", "2000-01-01T00:00:00Z"],
    ["/at/2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00Z"],
    ["/at/2000-01-01T00:00:00.001Z", "2000-01-01T00:00:10Z"],
    ["/at/2000-01-01T00:00:07Z", "2000-01-01T00:00:10Z"],
    ["/at/2000-01-01T00:00:59.5Z", "2000-01-01T00:01:00Z"],
    ["/at/2000-01-01T09:00:05%2B09:00", "2000-01-01T00:00:10Z"],
    ["/at/2999-01-01", "2999-01-01T00:00:00Z"],
  ];
  for (const [path, id] of cases) {
    const res = await req(path);
    assertEquals(res.status, 301, path);
    assertEquals(res.headers.get("location"), `/at/${id}`, path);
    assertEquals(
      res.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
      path,
    );
    assertEquals(res.headers.get("access-control-allow-origin"), "*", path);
    assertEquals(await res.text(), "", path);
  }
});

Deno.test("GET /at/<past moment> returns a key that decrypts for it", async () => {
  const plain = new TextEncoder().encode("秘密");
  for (const at of ["2000-01-01T00:00:00Z", "2000-01-01T00:00:10Z"]) {
    const enc = await encrypt(Uint8Array.fromBase64(pk), at, plain);
    const res = await req(`/at/${at}`);
    assertEquals(res.status, 200, at);
    assertEquals([...res.headers], [
      ["access-control-allow-origin", "*"],
      ["cache-control", "public, max-age=31536000, immutable"],
    ], at);
    const usk = new Uint8Array(await res.arrayBuffer());
    assertEquals(new Uint8Array(await decrypt(usk, enc)), plain, at);
  }
});

Deno.test("timeId rounds up to 10 s, and keeps a moment already on the step", () => {
  assertEquals(timeId("2030-01-01"), "2030-01-01T00:00:00Z");
  assertEquals(
    timeId(Date.UTC(2030, 0, 1, 0, 0, 0, 1)),
    "2030-01-01T00:00:10Z",
  );
  assertEquals(
    timeId(new Date("2030-01-01T00:00:10Z")),
    "2030-01-01T00:00:10Z",
  );
  assertThrows(() => timeId("foo"), RangeError);
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
