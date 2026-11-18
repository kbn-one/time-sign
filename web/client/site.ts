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

/** The meta of `/post` for a moment — or for none, which is what the static build writes. */
export function postMeta(t: string | null): PageMeta {
  const moment = isMoment(t) ? t : null;
  const when = moment ? formatUtc(moment) : null;
  const title = when
    ? `A message sealed until ${when}`
    : "A sealed message — time-sign";
  const description = when
    ? `Encrypted with time-lock encryption: nobody can read it before ${when}, not even the sender.`
    : "Encrypted with time-lock encryption: nobody can read it before its moment, not even the sender.";
  const player = `${SITE_ORIGIN}${routes.embed.href()}${
    moment ? `?t=${moment}` : ""
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
      "twitter:card": "player",
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

/**
 * The link that carries a sealed message: the moment in the query, where the server and card
 * crawlers see it, and the ciphertext in the fragment, which never leaves the reader's browser.
 */
export function postHref(
  origin: string,
  moment: string,
  ciphertext: Uint8Array,
): string {
  const c = ciphertext.toBase64({ alphabet: "base64url", omitPadding: true });
  return `${origin}${routes.post.href()}?t=${moment}#c=${c}`;
}

/** The moment and ciphertext a `/post` link carries, or what is wrong with it. */
export function parsePost(
  search: string,
  hash: string,
): { moment: string; ciphertext: Uint8Array } | { error: string } {
  const moment = new URLSearchParams(search).get("t");
  if (!isMoment(moment)) return { error: "This link has no valid moment." };
  const c = new URLSearchParams(hash.replace(/^#/, "")).get("c");
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
