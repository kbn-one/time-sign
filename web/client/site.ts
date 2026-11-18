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

/**
 * The meta of `/post` itself: a plain card, the same for every link.
 *
 * A private link (`/post?t=…#c=…`) is shared as it is, and nothing that reads it — a crawler, this
 * server — sees past the `#`, so its card cannot say more. An X-card link goes through og.kbn.one
 * instead ({@link shareHref}), whose card names the moment.
 */
export const POST_META: PageMeta = {
  title: "A sealed message — time-sign",
  tags: {
    description:
      "Encrypted with time-lock encryption: nobody can read it before its moment, not even the sender.",
    "og:type": "website",
    "og:site_name": "time-sign",
    "og:title": "A sealed message — time-sign",
    "og:description":
      "Encrypted with time-lock encryption: nobody can read it before its moment, not even the sender.",
    "og:image": CARD_IMAGE,
    "twitter:card": "summary",
    "twitter:title": "A sealed message — time-sign",
    "twitter:image": CARD_IMAGE,
  },
};

/** og.kbn.one's share endpoint, and this site's template for it (`static/og-card.svg`). */
export const OG_SHARE = "https://og.kbn.one/share";
export const CARD_TEMPLATE = `${new URL(SITE_ORIGIN).host}${
  routes.static.href({ path: "og-card.svg" })
}`;

/** `2030-01-01 00:00:00 UTC` */
export function formatUtc(moment: string): string {
  return moment.replace("T", " ").replace("Z", " UTC");
}

/** Which kind of link to share a sealed message as. */
export type LinkMode = "card" | "private";

/**
 * The link to share a sealed message by.
 *
 * - `private`: `/post?t=<moment>#c=<ciphertext>` on `origin`. The ciphertext is after the `#` and
 *   never leaves the reader's browser; X shows a plain card.
 * - `card`: og.kbn.one's share URL for `static/og-card.svg`, with the ciphertext in its query —
 *   og.kbn.one needs it to write X's player card. The template sends both the reader and the
 *   player to this site with the ciphertext after `#` (`/post?t=…#c=…`, `/embed?t=…#c=…`), so it
 *   still never reaches this server, which holds the master key.
 */
export function shareHref(
  origin: string,
  moment: string,
  ciphertext: Uint8Array,
  mode: LinkMode = "private",
): string {
  const c = ciphertext.toBase64({ alphabet: "base64url", omitPadding: true });
  if (mode === "private") {
    return `${origin}${routes.post.href()}?t=${moment}#c=${c}`;
  }
  const query = new URLSearchParams({
    tmpl: CARD_TEMPLATE,
    t: moment,
    when: formatUtc(moment),
    c,
  });
  return `${OG_SHARE}?${query}`;
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
