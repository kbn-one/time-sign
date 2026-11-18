/**
 * Where the site is served, and what its pages tell other sites about themselves.
 *
 * Card meta tags are read by crawlers (X's `Twitterbot` among them) that do not run JavaScript and
 * resolve nothing, so every URL here is absolute.
 */

import { routes } from "./routes.ts";

export const SITE_ORIGIN = "https://time-sign.kbn.one";

/** The square image every card shows: `static/card.png`, 675×675. */
export const CARD_IMAGE = `${SITE_ORIGIN}${
  routes.static.href({ path: "card.png" })
}`;

/** The X player card's frame size (larger sizes fall back to a plain image card). */
export const PLAYER_SIZE = 480;

/** Keys are issued every 10 seconds (`TIME_STEP_MS` in `client/time_id.ts`). */
export const STEP_MS = 10_000;

/** Whether `t` is a moment as the server issues keys for it: `YYYY-MM-DDTHH:MM:S0Z`. */
export function isMoment(t: string | null | undefined): t is string {
  if (!t || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d0Z$/.test(t)) return false;
  return !isNaN(Date.parse(t));
}

/** A page's `<title>` and its meta tags, by `name` (or `property` for `og:*`). */
export interface PageMeta {
  title: string;
  tags: Record<string, string>;
}

/** A base64url ciphertext as it may appear in a link: nothing else, and not absurdly long. */
function isCiphertextParam(c: string | null): c is string {
  return !!c && c.length <= 8192 && /^[A-Za-z0-9_-]+$/.test(c);
}

/**
 * The meta of `/post` for the link's query — or for none, which is what the static build writes.
 *
 * With the ciphertext in the query (`?t=…&c=…`, an X-card link) the card is a player:
 * `/embed?t=…&c=…`, which opens the message inside the card once the moment has passed. Without
 * it (a private link, ciphertext after `#`) the card cannot reach the message, so it is a plain
 * `summary` card whose click opens the link itself. Every tag is present either way, because the
 * Worker rewrites the static file's tags rather than adding any (`worker.ts`); X ignores the
 * `twitter:player*` tags of a card that is not a player.
 */
export function postMeta(t: string | null, c: string | null = null): PageMeta {
  const moment = isMoment(t) ? t : null;
  const inQuery = moment !== null && isCiphertextParam(c);
  const when = moment ? formatUtc(moment) : null;
  const title = when
    ? `A message sealed until ${when}`
    : "A sealed message — time-sign";
  const description = when
    ? `Encrypted with time-lock encryption: nobody can read it before ${when}, not even the sender.`
    : "Encrypted with time-lock encryption: nobody can read it before its moment, not even the sender.";
  const player = `${SITE_ORIGIN}${routes.embed.href()}${
    moment ? `?t=${moment}${inQuery ? `&c=${c}` : ""}` : ""
  }`;
  return {
    title,
    tags: {
      description,
      "og:type": "website",
      "og:site_name": "time-sign",
      "og:title": title,
      "og:description": description,
      "og:image": CARD_IMAGE,
      "twitter:card": inQuery ? "player" : "summary",
      "twitter:title": title,
      "twitter:description": description,
      "twitter:image": CARD_IMAGE,
      "twitter:player": player,
      "twitter:player:width": String(PLAYER_SIZE),
      "twitter:player:height": String(PLAYER_SIZE),
    },
  };
}

/** `2030-01-01 00:00:00 UTC` */
export function formatUtc(moment: string): string {
  return moment.replace("T", " ").replace("Z", " UTC");
}

/** Where a link puts the ciphertext. */
export type LinkMode = "card" | "private";

/**
 * The link that carries a sealed message. The moment is always in the query, where the server and
 * card crawlers see it. The ciphertext is in the query too for an X-card link (`card`), so the
 * card can open the message — which means it reaches this server — or after `#` for a private
 * link (`private`), which never leaves the reader's browser.
 */
export function postHref(
  origin: string,
  moment: string,
  ciphertext: Uint8Array,
  mode: LinkMode = "private",
): string {
  const c = ciphertext.toBase64({ alphabet: "base64url", omitPadding: true });
  const base = `${origin}${routes.post.href()}?t=${moment}`;
  return mode === "card" ? `${base}&c=${c}` : `${base}#c=${c}`;
}

/** The moment and ciphertext a link carries (`c` from the query or the fragment), or what is wrong with it. */
export function parsePost(
  search: string,
  hash: string,
): { moment: string; ciphertext: Uint8Array } | { error: string } {
  const query = new URLSearchParams(search);
  const moment = query.get("t");
  if (!isMoment(moment)) return { error: "This link has no valid moment." };
  const c = query.get("c") ??
    new URLSearchParams(hash.replace(/^#/, "")).get("c");
  if (!c) return { error: "This link has no message in it." };
  try {
    return {
      moment,
      ciphertext: Uint8Array.fromBase64(c, { alphabet: "base64url" }),
    };
  } catch {
    return { error: "The message in this link is damaged." };
  }
}
