/**
 * The time-sign client (`client/mod.ts`), loaded in the browser from `/time-sign.js` on first use.
 *
 * It is a separate bundle with the WebAssembly inlined, so a page pays for it only when it seals or
 * opens a message.
 */

import { routes } from "./routes.ts";

/** The part of `client/mod.ts` the pages use. */
export interface TimeSignClient {
  encrypt(mpk: Uint8Array, id: string, plain: Uint8Array): Promise<Uint8Array>;
  decrypt(usk: Uint8Array, enc: Uint8Array): Promise<ArrayBuffer>;
  timeId(at: Date | number | string): string;
}

let client: Promise<TimeSignClient> | undefined;

export function loadClient(): Promise<TimeSignClient> {
  return client ??= import(routes.lib.href()) as Promise<TimeSignClient>;
}

/** The outcome of asking the server for the key to a moment. */
export type KeyAnswer = { kind: "locked" } | { kind: "key"; usk: Uint8Array };

/** Asks `/at/<moment>` for the key: refused (text) before the moment, the key's bytes after. */
export async function fetchKey(moment: string): Promise<KeyAnswer> {
  const response = await fetch(routes.at.href({ at: moment }));
  if (!response.ok) throw new Error(`at: ${response.status}`);
  if (response.headers.get("content-type")?.startsWith("text/")) {
    await response.body?.cancel();
    return { kind: "locked" };
  }
  return { kind: "key", usk: new Uint8Array(await response.arrayBuffer()) };
}
