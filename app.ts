import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";

export type Bindings = {
  /** base64 encoded master public key */
  IBKEM_PUBLIC_KEY: string;
  /** base64 encoded master secret key */
  IBKEM_SECRET_KEY: string;
};

type ExtractUsk = (sk: Uint8Array, id: string) => Uint8Array;

export function createApp(extract_usk: ExtractUsk) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use(
    "/",
    cors({
      origin: "*",
      allowMethods: ["GET"],
    }),
  );
  app.get(
    "/master_pk",
    (c) => c.body(Uint8Array.fromBase64(c.env.IBKEM_PUBLIC_KEY)),
  );
  app.get("/at/:at", (c) => {
    const at = c.req.param("at");
    const at_date = Date.parse(at);
    if (isNaN(at_date)) {
      c.status(400);
      return c.text("Invalid date");
    }
    if (Date.now() < at_date) {
      return c.text("It is not the time");
    } else {
      const sk = Uint8Array.fromBase64(c.env.IBKEM_SECRET_KEY);
      const usk = extract_usk(sk, at);
      return c.body(usk as Uint8Array<ArrayBuffer>);
    }
  });
  app.get("/", (c) => {
    return c.text(`
  Usage:
  /master_pk to get the master public key
  /at/<date> to get the secret key for the given date
  `);
  });
  return app;
}
