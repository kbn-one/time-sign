/**
 * The X player card for a post: `/embed?t=<moment>#c=<ciphertext>`, in X's iframe.
 *
 * The iframe gets only what the card's `twitter:player` URL says — og.kbn.one writes it from
 * `static/og-card.svg` (`og-card-en.svg` for `/en/embed`), with the ciphertext after `#` so it never reaches this server. Once the
 * moment has passed the card asks `/at/<moment>` for the key and opens the message right in the
 * post. Without one it can only count down and point at the link.
 * It fills the frame (245–500 px wide), and links open in a new tab: the frame is sandboxed, with
 * popups allowed and no modals or forms.
 */

import {
  clientEntry,
  css,
  type Handle,
  type SerializableValue,
} from "remix/component";

import {
  formatDuration,
  formatMoment,
  type Lang,
  type Messages,
  messages,
} from "../i18n.ts";
import { pagesFor } from "../routes.ts";
import { isMoment, parsePost, SITE_ORIGIN } from "../site.ts";
import { fetchKey, loadClient } from "../time_sign_client.ts";
import { color } from "../tokens.ts";

type State =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "locked" }
  | { kind: "unlocked" }
  | { kind: "opening" }
  | { kind: "opened"; text: string }
  | { kind: "error"; text: string };

export interface SealedCardProps {
  lang: Lang;
  [key: string]: SerializableValue;
}

export const SealedCard = clientEntry(
  import.meta.url,
  function SealedCard(handle: Handle<SealedCardProps>) {
    let state: State = { kind: "loading" };
    let moment = "";
    let ciphertext: Uint8Array | null = null;
    let now = 0;
    let opening = false;

    async function open() {
      if (!ciphertext || opening) return;
      opening = true;
      state = { kind: "opening" };
      handle.update();
      try {
        const answer = await fetchKey(moment);
        if (answer.kind === "locked") {
          state = { kind: "locked" }; // the server's clock is behind: the timer tries again
        } else {
          const { decrypt } = await loadClient();
          const plain = await decrypt(answer.usk, ciphertext);
          state = { kind: "opened", text: new TextDecoder().decode(plain) };
        }
      } catch (error) {
        state = { kind: "error", text: String(error) };
      }
      opening = false;
      handle.update();
    }

    function tick() {
      now = Date.now();
      if (state.kind === "locked" && Date.parse(moment) <= now) {
        if (ciphertext) open();
        else state = { kind: "unlocked" };
      }
      handle.update();
    }

    handle.queueTask(() => {
      const t = new URLSearchParams(location.search).get("t");
      const parsed = parsePost(location.search, location.hash);
      if ("error" in parsed) {
        // No ciphertext (a private link's card): a countdown only, if there is a moment at all.
        if (isMoment(t)) {
          moment = t;
          state = { kind: "locked" };
        } else {
          state = { kind: "none" };
        }
      } else {
        ({ moment, ciphertext } = parsed);
        state = { kind: "locked" };
      }
      tick();
      const timer = setInterval(tick, 1000);
      handle.signal.addEventListener("abort", () => clearInterval(timer), {
        once: true,
      });
    });

    return () => (
      <div mix={frameStyle}>
        {
          /* A box of its own: the states differ in how many nodes they are, and as bare siblings of
            the brand line, new ones were placed after it. */
        }
        <div mix={stateStyle}>
          {view(state, moment, now, handle.props.lang)}
        </div>
        <p mix={brandStyle}>
          {messages[handle.props.lang].card.brand[0]}
          <a
            href={`${SITE_ORIGIN}${pagesFor(handle.props.lang).home.href()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            time-sign
          </a>
          {messages[handle.props.lang].card.brand[1]}
        </p>
      </div>
    );
  },
);

function view(state: State, moment: string, now: number, lang: Lang) {
  const m: Messages["card"] = messages[lang].card;
  switch (state.kind) {
    case "loading":
    case "none":
      return (
        <>
          <div mix={lockStyle} aria-hidden="true">🔒</div>
          <p mix={headStyle}>{m.sealedMessage}</p>
        </>
      );
    case "locked": {
      const left = Date.parse(moment) - now;
      return (
        <>
          <div mix={lockStyle} aria-hidden="true">🔒</div>
          <p mix={headStyle}>{m.opensIn}</p>
          <p mix={countStyle}>
            {left > 0 ? formatDuration(left, lang) : m.soon}
          </p>
          <p mix={subStyle}>{formatMoment(moment, lang)}</p>
        </>
      );
    }
    case "unlocked":
      return (
        <>
          <div mix={lockStyle} aria-hidden="true">🔓</div>
          <p mix={headStyle}>{m.openNow}</p>
          <p mix={subStyle}>{m.openTheLink}</p>
        </>
      );
    case "opening":
      return (
        <>
          <div mix={lockStyle} aria-hidden="true">🔓</div>
          <p mix={subStyle}>{m.opening}</p>
        </>
      );
    case "opened":
      return (
        <>
          <p mix={subStyle}>{m.sealedUntil(formatMoment(moment, lang))}</p>
          <p mix={messageStyle}>{state.text}</p>
        </>
      );
    case "error":
      return (
        <>
          <div mix={lockStyle} aria-hidden="true">⚠️</div>
          <p mix={subStyle}>{state.text}</p>
        </>
      );
  }
}

const frameStyle = css({
  boxSizing: "border-box",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "1rem",
  textAlign: "center",
  background: color.card,
});

const stateStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.4rem",
  maxWidth: "100%",
});

const lockStyle = css({ fontSize: "clamp(2.5rem, 18vw, 5rem)" });

const headStyle = css({ margin: 0, fontSize: "1.2rem", fontWeight: 700 });

const countStyle = css({
  margin: 0,
  fontSize: "clamp(1.8rem, 11vw, 3rem)",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
});

const subStyle = css({ margin: 0, color: color.muted, fontSize: "0.9rem" });

const messageStyle = css({
  margin: "0.5rem 0 0",
  maxWidth: "100%",
  maxHeight: "60vh",
  overflow: "auto",
  fontSize: "clamp(1.1rem, 6vw, 1.6rem)",
  fontWeight: 600,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

const brandStyle = css({
  margin: "1rem 0 0",
  color: color.muted,
  fontSize: "0.8rem",
});
