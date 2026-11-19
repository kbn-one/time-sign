/**
 * Where the site is served, and what its pages tell other sites about themselves.
 *
 * Card meta tags are read by crawlers (X's `Twitterbot` among them) that do not run JavaScript and
 * resolve nothing, so every URL here is absolute.
 */

import { formatMoment, type Lang, type LinkError } from "./i18n.ts";
import { pagesFor, routes } from "./routes.ts";

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
 * The meta of a language's `/post`: a plain card, the same for every link.
 *
 * A private link (`/post?t=…#c=…`) is shared as it is, and nothing that reads it — a crawler, this
 * server — sees past the `#`, so its card cannot say more. An X-card link goes through og.kbn.one
 * instead ({@link shareHref}), whose card names the moment.
 */
export function postMeta(lang: Lang): PageMeta {
  const [title, description] = lang === "ja"
    ? [
      "封印されたメッセージ — time-sign",
      "時限暗号で封印されています。その時が来るまで、送った本人も含めて誰も読めません。",
    ]
    : [
      "A sealed message — time-sign",
      "Encrypted with time-lock encryption: nobody can read it before its moment, not even the sender.",
    ];
  return {
    title,
    tags: {
      description,
      "og:type": "website",
      "og:site_name": "time-sign",
      "og:title": title,
      "og:description": description,
      "og:image": CARD_IMAGE,
      "twitter:card": "summary",
      "twitter:title": title,
      "twitter:image": CARD_IMAGE,
    },
  };
}

/** og.kbn.one's share endpoint, and this site's template for it per language (`static/og-card*.svg`). */
export const OG_SHARE = "https://og.kbn.one/share";
export const CARD_TEMPLATES: Record<Lang, string> = {
  ja: `${new URL(SITE_ORIGIN).host}${
    routes.static.href({ path: "og-card.svg" })
  }`,
  en: `${new URL(SITE_ORIGIN).host}${
    routes.static.href({ path: "og-card-en.svg" })
  }`,
};

/** Which kind of link to share a sealed message as. */
export type LinkMode = "card" | "private";

/**
 * The link to share a sealed message by, for readers of `lang`.
 *
 * - `private`: the language's `/post?t=<moment>#c=<ciphertext>` on `origin`. The ciphertext is after the `#` and
 *   never leaves the reader's browser; X shows a plain card.
 * - `card`: og.kbn.one's share URL for the language's template (`static/og-card.svg`,
 *   `static/og-card-en.svg`), with the ciphertext in its query —
 *   og.kbn.one needs it to write X's player card. The template sends both the reader and the
 *   player to this site with the ciphertext after `#` (`/post?t=…#c=…`, `/embed?t=…#c=…`), so it
 *   still never reaches this server, which holds the master key. The card's `when` is the moment
 *   as the sharer reads it: this runs in their browser, so it is their time zone, abbreviated.
 */
export function shareHref(
  origin: string,
  moment: string,
  ciphertext: Uint8Array,
  mode: LinkMode = "private",
  lang: Lang = "ja",
  timeZone?: string,
): string {
  const c = ciphertext.toBase64({ alphabet: "base64url", omitPadding: true });
  if (mode === "private") {
    return `${origin}${pagesFor(lang).post.href()}?t=${moment}#c=${c}`;
  }
  const query = new URLSearchParams({
    tmpl: CARD_TEMPLATES[lang],
    t: moment,
    when: formatMoment(moment, lang, timeZone),
    c,
  });
  return `${OG_SHARE}?${query}`;
}

/** The moment and ciphertext a link carries (`c` from the query or the fragment), or what is wrong with it. */
export function parsePost(
  search: string,
  hash: string,
): { moment: string; ciphertext: Uint8Array } | { error: LinkError } {
  const query = new URLSearchParams(search);
  const moment = query.get("t");
  if (!isMoment(moment)) return { error: "noMoment" };
  const c = query.get("c") ??
    new URLSearchParams(hash.replace(/^#/, "")).get("c");
  if (!c) return { error: "noMessage" };
  try {
    return {
      moment,
      ciphertext: Uint8Array.fromBase64(c, { alphabet: "base64url" }),
    };
  } catch {
    return { error: "damaged" };
  }
}
