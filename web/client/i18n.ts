/**
 * The two languages the site is written in, and how it says a moment.
 *
 * Japanese is the site's own language at `/`; English is under `/en` (`pagesFor()` in
 * `routes.ts`). Every string an island or the shell shows is here, once per language, under the
 * same keys — `Messages` is the shape both have to fill, so a string missing from one is a type
 * error. Page prose lives in the page modules themselves, written out in each language.
 *
 * A moment is always shown in the reader's own time zone, with its abbreviation, so there is no
 * guessing which 14:00 it is: `2026/11/18 14:00:00 JST`, `Nov 18, 2026, 2:00:00 PM GMT+9`. The one
 * exception is a card on another site (og.kbn.one's image and title), which is written once for
 * whoever sees it: it says the moment in the sharer's time zone (`shareHref()` in `site.ts`).
 */

export type Lang = "ja" | "en";

export const LANGS: readonly Lang[] = ["ja", "en"];

export function isLang(value: unknown): value is Lang {
  return value === "ja" || value === "en";
}

const LOCALES: Record<Lang, string> = { ja: "ja-JP", en: "en-US" };

/**
 * A moment as the reader reads it: in `timeZone` (the reader's own when omitted), with the zone's
 * abbreviation.
 */
export function formatMoment(
  moment: string | number | Date,
  lang: Lang,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
  }).format(new Date(moment)) +
    ` ${zoneName(new Date(moment), lang, timeZone)}`;
}

/** The time zone's abbreviation at `date`: `JST`, `GMT+9`, `EST`. */
function zoneName(date: Date, lang: Lang, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZoneName: "short",
    timeZone,
  }).formatToParts(date).find((part) => part.type === "timeZoneName")
    ?.value ?? "";
}

/** The reader's time zone, as the date field is in it: `JST (Asia/Tokyo)`. */
export function timeZoneLabel(lang: Lang, timeZone?: string): string {
  const zone = timeZone ??
    new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${zoneName(new Date(), lang, zone)} (${zone})`;
}

/** How long until a moment: `1 h 2 min` / `1時間2分`. */
export function formatDuration(ms: number, lang: Lang): string {
  const s = Math.ceil(ms / 1000);
  const ja = lang === "ja";
  if (s < 60) return ja ? `${s}秒` : `${s} s`;
  if (s < 3600) {
    const [m, r] = [Math.floor(s / 60), s % 60];
    return ja ? `${m}分${r}秒` : `${m} min ${r} s`;
  }
  const h = Math.floor(s / 3600);
  if (h < 48) {
    const m = Math.floor((s % 3600) / 60);
    return ja ? `${h}時間${m}分` : `${h} h ${m} min`;
  }
  const d = Math.floor(h / 24);
  return ja ? `${d}日` : `${d} days`;
}

/** What `parsePost()` (`site.ts`) found wrong with a link. */
export type LinkError = "noMoment" | "noMessage" | "damaged";

export interface Messages {
  nav: { demo: string; otherLanguage: string; footer: string };
  demo: {
    sealHeading: string;
    message: string;
    defaultMessage: string;
    openAfter: string;
    presets: [label: string, ms: number][];
    seal: string;
    sealing: string;
    pickValid: string;
    fetchKey: string;
    previewHeading: string;
    sealedFor: [before: string, after: string];
    sealedLabel: string;
    open: string;
    forget: string;
    locked: (left: string) => string;
    lockedNow: string;
    opened: string;
    shareHeading: string;
    linkModes: { private: [string, string]; card: [string, string] };
    badIdentity: string;
    emptyCiphertext: string;
    badCiphertext: string;
  };
  post: {
    reading: string;
    sealedUntil: (when: string) => string;
    opensIn: (left: string) => string;
    opening: string;
    asking: string;
    opened: (when: string) => string;
    tryAgain: string;
    ownLink: string;
    linkErrors: Record<LinkError, string>;
  };
  card: {
    sealedMessage: string;
    opensIn: string;
    soon: string;
    openNow: string;
    openTheLink: string;
    opening: string;
    sealedUntil: (when: string) => string;
    brand: [before: string, after: string];
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const messages: Record<Lang, Messages> = {
  ja: {
    nav: {
      demo: "デモ",
      otherLanguage: "English",
      footer: "ソースコードと鍵の来歴:",
    },
    demo: {
      sealHeading: "1. 封をする",
      message: "メッセージ",
      defaultMessage:
        "**過去から**こんにちは。\n\n- Markdown で書けます\n- URL はリンクになります: https://time-sign.kbn.one",
      openAfter: "開封できる日時",
      presets: [
        ["1分後", MINUTE],
        ["10分後", 10 * MINUTE],
        ["1時間後", HOUR],
        ["24時間後", 24 * HOUR],
        ["1週間後", 7 * 24 * HOUR],
      ],
      seal: "封をする",
      sealing: "封をしています…",
      pickValid: "正しい日時を選んでください。",
      fetchKey: "サーバーに鍵を問い合わせています…",
      previewHeading: "2. プレビュー",
      sealedFor: ["", " まで封印しました。"],
      sealedLabel: "封をしたメッセージ（別のものを貼り付けても開けます）",
      open: "開封する",
      forget: "破棄",
      locked: (left) => `🔒 まだその時ではありません。あと ${left}。`,
      lockedNow: "🔒 もう開封できるはずです。もう一度試してください。",
      opened: "🔓 開封しました:",
      shareHeading: "3. 共有",
      linkModes: {
        private: [
          "プライベートリンク",
          "暗号文は # の後ろに入り、どのサーバーにも送られません。X では通常のリンクカードになり、リンクを開くと読めます。",
        ],
        card: [
          "X 用（プレイヤーカード、og.kbn.one 経由）",
          "X のカードがカウントダウンし、その時が来ると投稿の中で開封されます。カードを作る og.kbn.one は暗号文を見ますが、マスター鍵を持つこのサーバーには届きません。",
        ],
      },
      badIdentity:
        "# identity には 2030-01-01T00:00:00Z のような時刻（秒の 1 の位は 0）を入れてください。",
      emptyCiphertext: "# ciphertext が空です。",
      badCiphertext: "# ciphertext が base64 ではありません。",
    },
    post: {
      reading: "リンクを読み込んでいます…",
      sealedUntil: (when) => `🔒 ${when} まで封印されています`,
      opensIn: (left) =>
        `あと ${left} で開封できます。このページを開いたままにするか、また後で来てください。`,
      opening: "開封しています…",
      asking: "サーバーに鍵を問い合わせています…",
      opened: (when) => `🔓 開封しました（${when} まで封印）`,
      tryAgain: "もう一度",
      ownLink: "自分でもメッセージを封印する",
      linkErrors: {
        noMoment: "このリンクには正しい時刻が入っていません。",
        noMessage: "このリンクにはメッセージが入っていません。",
        damaged: "このリンクのメッセージは壊れています。",
      },
    },
    card: {
      sealedMessage: "封印されたメッセージ",
      opensIn: "開封まで",
      soon: "まもなく",
      openNow: "開封できるようになりました",
      openTheLink: "投稿のリンクを開いて読んでください。",
      opening: "開封しています…",
      sealedUntil: (when) => `🔓 ${when} まで封印されていました`,
      brand: ["", " で時限暗号化"],
    },
  },
  en: {
    nav: {
      demo: "Demo",
      otherLanguage: "日本語",
      footer: "Source and key provenance:",
    },
    demo: {
      sealHeading: "1. Seal",
      message: "Message",
      defaultMessage:
        "Hello **from the past**.\n\n- Write it in Markdown\n- URLs become links: https://time-sign.kbn.one/en",
      openAfter: "Open after",
      presets: [
        ["in 1 minute", MINUTE],
        ["in 10 minutes", 10 * MINUTE],
        ["in 1 hour", HOUR],
        ["in 24 hours", 24 * HOUR],
        ["in 1 week", 7 * 24 * HOUR],
      ],
      seal: "Seal message",
      sealing: "Sealing…",
      pickValid: "Pick a valid date and time.",
      fetchKey: "Asking the server for the key…",
      previewHeading: "2. Preview",
      sealedFor: ["Sealed for ", "."],
      sealedLabel: "Sealed message — this one, or paste another",
      open: "Open",
      forget: "Forget",
      locked: (left) =>
        `🔒 The server says it is not the time yet. ${left} to go.`,
      lockedNow: "🔒 It should be now — try again.",
      opened: "🔓 Opened:",
      shareHeading: "3. Share",
      linkModes: {
        private: [
          "Private link",
          "The ciphertext rides after the # and never reaches any server. On X it shows as a plain link card; the message is read by opening the link.",
        ],
        card: [
          "For X (player card, via og.kbn.one)",
          "On X the card counts down and then opens the message right in the post. og.kbn.one, which writes the card, sees the ciphertext; this server, which holds the master key, still does not.",
        ],
      },
      badIdentity:
        "The # identity section needs a moment like 2030-01-01T00:00:00Z (seconds ending in 0).",
      emptyCiphertext: "The # ciphertext section is empty.",
      badCiphertext: "The # ciphertext section is not base64.",
    },
    post: {
      reading: "Reading the link…",
      sealedUntil: (when) => `🔒 Sealed until ${when}`,
      opensIn: (left) =>
        `Opens in ${left}. Keep this page open, or come back later.`,
      opening: "Opening…",
      asking: "Asking the server for the key…",
      opened: (when) => `🔓 Opened — sealed until ${when}`,
      tryAgain: "Try again",
      ownLink: "Seal a message of your own",
      linkErrors: {
        noMoment: "This link has no valid moment.",
        noMessage: "This link has no message in it.",
        damaged: "The message in this link is damaged.",
      },
    },
    card: {
      sealedMessage: "A sealed message",
      opensIn: "Opens in",
      soon: "a moment",
      openNow: "It can be opened now",
      openTheLink: "Open the link in the post to read it.",
      opening: "Opening…",
      sealedUntil: (when) => `🔓 Sealed until ${when}`,
      brand: ["time-lock encrypted with ", ""],
    },
  },
};
