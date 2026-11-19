/**
 * The message a `/post?t=<moment>#c=<ciphertext>` link carries.
 *
 * Everything comes from the address: the moment from the query and the ciphertext from the
 * fragment, which the browser never sends anywhere. Before the moment it counts down; when the
 * moment comes it asks `/at/<moment>` for the key and opens the message in the page.
 */

import {
  clientEntry,
  css,
  type Handle,
  on,
  type RemixNode,
  type SerializableValue,
} from "remix/component";

import "../share_buttons.ts";
import { formatDuration, formatMoment, type Lang, messages } from "../i18n.ts";
import { pagesFor } from "../routes.ts";
import { renderMessage } from "../message_view.ts";
import { parsePost } from "../site.ts";
import { fetchKey, loadClient } from "../time_sign_client.ts";
import { color, radius } from "../tokens.ts";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; text: string }
  | { kind: "locked" }
  | { kind: "opening" }
  | { kind: "opened"; node: RemixNode }
  | { kind: "error"; text: string };

export interface SealedMessageProps {
  lang: Lang;
  [key: string]: SerializableValue;
}

export const SealedMessage = clientEntry(
  import.meta.url,
  function SealedMessage(handle: Handle<SealedMessageProps>) {
    let state: State = { kind: "loading" };
    let moment = "";
    let ciphertext: Uint8Array = new Uint8Array();
    let now = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function open() {
      clearTimeout(retry);
      state = { kind: "opening" };
      handle.update();
      try {
        const answer = await fetchKey(moment);
        if (answer.kind === "locked") {
          // The moment has not come by the server's clock yet: ask again shortly.
          state = { kind: "locked" };
          retry = setTimeout(open, 2000);
        } else {
          const { decrypt } = await loadClient();
          const plain = await decrypt(answer.usk, ciphertext);
          state = {
            kind: "opened",
            node: await renderMessage(new TextDecoder().decode(plain)),
          };
        }
      } catch (error) {
        state = { kind: "error", text: String(error) };
      }
      handle.update();
    }

    // Client only: the address, and the clock, exist only in the browser.
    handle.queueTask(() => {
      const parsed = parsePost(location.search, location.hash);
      if ("error" in parsed) {
        state = {
          kind: "invalid",
          text: messages[handle.props.lang].post.linkErrors[parsed.error],
        };
        handle.update();
        return;
      }
      ({ moment, ciphertext } = parsed);
      now = Date.now();
      if (Date.parse(moment) <= now) {
        open();
      } else {
        state = { kind: "locked" };
        handle.update();
      }
      const timer = setInterval(() => {
        now = Date.now();
        if (state.kind !== "locked") return;
        if (Date.parse(moment) <= now && retry === undefined) open();
        else handle.update();
      }, 1000);
      handle.signal.addEventListener("abort", () => {
        clearInterval(timer);
        clearTimeout(retry);
      }, { once: true });
    });

    return () => (
      <div mix={rootStyle}>
        <section mix={cardStyle} aria-live="polite">
          {body(state, moment, now, open, handle.props.lang)}
        </section>
        <div mix={footStyle}>
          <share-buttons />
          <a href={pagesFor(handle.props.lang).demo.href()}>
            {messages[handle.props.lang].post.ownLink}
          </a>
        </div>
      </div>
    );
  },
);

function body(
  state: State,
  moment: string,
  now: number,
  open: () => void,
  lang: Lang,
) {
  const m = messages[lang].post;
  const when = moment ? formatMoment(moment, lang) : "";
  switch (state.kind) {
    case "loading":
      return <p mix={mutedStyle}>{m.reading}</p>;
    case "invalid":
      return <p role="alert" mix={errorStyle}>{state.text}</p>;
    case "locked": {
      const left = Date.parse(moment) - now;
      return (
        <>
          <p mix={bigStyle}>{m.sealedUntil(when)}</p>
          <p mix={mutedStyle}>
            {left > 0 ? m.opensIn(formatDuration(left, lang)) : m.opening}
          </p>
        </>
      );
    }
    case "opening":
      return <p mix={mutedStyle}>{m.asking}</p>;
    case "opened":
      return (
        <>
          <p mix={bigStyle}>{m.opened(when)}</p>
          <blockquote mix={messageStyle}>{state.node}</blockquote>
        </>
      );
    case "error":
      return (
        <>
          <p role="alert" mix={errorStyle}>{state.text}</p>
          <button type="button" mix={[buttonStyle, on("click", open)]}>
            {m.tryAgain}
          </button>
        </>
      );
  }
}

const rootStyle = css({ display: "grid", gap: "1rem" });

const cardStyle = css({
  display: "grid",
  gap: "0.5rem",
  padding: "1.5rem",
  background: color.card,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
});

const bigStyle = css({ margin: 0, fontSize: "1.25rem", fontWeight: 700 });

const mutedStyle = css({ margin: 0, color: color.muted });

const errorStyle = css({ margin: 0, color: color.danger });

const messageStyle = css({
  margin: 0,
  padding: "0.75rem 1rem",
  borderLeft: `3px solid ${color.accent}`,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: "1.1rem",
  "& > :first-child": { marginTop: 0 },
  "& > :last-child": { marginBottom: 0 },
  "& p, & ul, & ol, & pre, & blockquote": { margin: "0.5em 0" },
  "& pre": { whiteSpace: "pre-wrap" },
});

const footStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
});

const buttonStyle = css({
  justifySelf: "start",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0.5rem 1.1rem",
  border: `1px solid ${color.accent}`,
  borderRadius: radius.md,
  background: color.accent,
  color: color.onAccent,
});
