/**
 * The demo: seal a message for a moment, then try to open it.
 *
 * Sealing fetches the master public key and encrypts in the page with the time-sign client
 * (`/time-sign.js`, imported on first use). Opening fetches `/at/<moment>`: before the moment the
 * server answers "It is not the time", after it the user secret key, which decrypts the message.
 *
 * The moment is the identity, so it is fixed to the one spelling the server issues keys for —
 * `timeId()`, rounded up to 10 seconds — when sealing, and opening asks for exactly that string. The sealed message is kept in `localStorage`.
 */

import { clientEntry, css, type Handle, on, ref } from "remix/component";

import "../share_buttons.ts";
import { routes } from "../routes.ts";
import { type LinkMode, shareHref } from "../site.ts";
import { fetchKey, formatDuration, loadClient } from "../time_sign_client.ts";
import { color, radius } from "../tokens.ts";

interface Sealed {
  /** The moment, as the identity it was sealed for. */
  id: string;
  /** The ciphertext, base64. */
  ciphertext: string;
}

type Outcome =
  | { kind: "none" }
  | { kind: "busy"; text: string }
  | { kind: "locked" }
  | { kind: "opened"; text: string }
  | { kind: "error"; text: string };

const STORAGE_KEY = "time-sign-demo";

/** The two kinds of share link, and what choosing one means. */
const LINK_MODES: [mode: LinkMode, label: string, explanation: string][] = [
  [
    "private",
    "Private link",
    "The ciphertext rides after the # and never reaches any server. On X it shows as a plain link card; the message is read by opening the link.",
  ],
  [
    "card",
    "For X (player card, via og.kbn.one)",
    "On X the card counts down and then opens the message right in the post. og.kbn.one, which writes the card, sees the ciphertext; this server, which holds the master key, still does not.",
  ],
];

/** Keys are issued every 10 seconds (`TIME_STEP_MS` in `client/time_id.ts`). */
const STEP_MS = 10_000;

const PRESETS: [label: string, ms: number][] = [
  ["in 10 seconds", 10_000],
  ["in 1 minute", 60_000],
  ["in 1 hour", 3_600_000],
  ["1 day ago", -86_400_000],
];

export const TimeLockDemo = clientEntry(
  import.meta.url,
  function TimeLockDemo(handle: Handle) {
    let message = "Hello from the past.";
    /** The moment as a `datetime-local` value, in local time. */
    let moment = "";
    /** Bumped to remount the date input when a preset replaces its value. */
    let momentKey = 0;
    /**
     * The fields themselves. Sealing reads what they hold rather than what the `input` handlers
     * last saw: text typed before the page finished hydrating is in the field but never reached a
     * handler, and would otherwise be sealed as the default.
     */
    let messageField: HTMLTextAreaElement | null = null;
    let momentField: HTMLInputElement | null = null;
    let sealed: Sealed | null = null;
    /** Where the share link puts the ciphertext — see `LINK_MODES`. */
    let mode: LinkMode = "private";
    let outcome: Outcome = { kind: "none" };
    let now = 0;

    /** Sets the moment, rounded up to the 10 s step keys are issued on, and shows it. */
    function setMoment(at: number) {
      moment = toLocalInput(new Date(Math.ceil(at / STEP_MS) * STEP_MS));
      momentKey++;
    }

    // Client only: the static build has no "now", and no storage.
    handle.queueTask(() => {
      now = Date.now();
      setMoment(Date.now() + 60_000);
      sealed = readSealed();
      handle.update();
      const timer = setInterval(() => {
        now = Date.now();
        if (outcome.kind === "locked") handle.update();
      }, 1000);
      handle.signal.addEventListener("abort", () => clearInterval(timer), {
        once: true,
      });
    });

    async function seal() {
      if (messageField) message = messageField.value;
      if (momentField) moment = momentField.value;
      const at = new Date(moment);
      if (isNaN(at.getTime())) {
        outcome = { kind: "error", text: "Pick a valid date and time." };
        handle.update();
        return;
      }
      outcome = { kind: "busy", text: "Sealing…" };
      handle.update();
      try {
        const { encrypt, timeId } = await loadClient();
        const response = await fetch(routes.masterPk.href());
        if (!response.ok) throw new Error(`master_pk: ${response.status}`);
        const mpk = new Uint8Array(await response.arrayBuffer());
        const id = timeId(at);
        const enc = await encrypt(mpk, id, new TextEncoder().encode(message));
        sealed = { id, ciphertext: enc.toBase64() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sealed));
        outcome = { kind: "none" };
      } catch (error) {
        outcome = { kind: "error", text: String(error) };
      }
      handle.update();
    }

    async function open() {
      if (!sealed) return;
      outcome = { kind: "busy", text: "Asking the server for the key…" };
      handle.update();
      try {
        const { decrypt } = await loadClient();
        const answer = await fetchKey(sealed.id);
        if (answer.kind === "locked") {
          now = Date.now();
          outcome = { kind: "locked" };
        } else {
          const plain = await decrypt(
            answer.usk,
            Uint8Array.fromBase64(sealed.ciphertext),
          );
          outcome = { kind: "opened", text: new TextDecoder().decode(plain) };
        }
      } catch (error) {
        outcome = { kind: "error", text: String(error) };
      }
      handle.update();
    }

    function forget() {
      sealed = null;
      outcome = { kind: "none" };
      localStorage.removeItem(STORAGE_KEY);
      handle.update();
    }

    return () => (
      <div mix={rootStyle}>
        <section mix={cardStyle} aria-label="Seal">
          <h2 mix={stepStyle}>1. Seal</h2>
          <label mix={fieldStyle}>
            Message
            <textarea
              rows={3}
              defaultValue={message}
              mix={[
                inputStyle,
                ref((node) => {
                  messageField = node as HTMLTextAreaElement;
                }),
                on("input", (event) => {
                  message = event.currentTarget.value;
                }),
              ]}
            />
          </label>
          <label mix={fieldStyle}>
            Open after
            <input
              key={momentKey}
              type="datetime-local"
              step="10"
              defaultValue={moment}
              mix={[
                inputStyle,
                ref((node) => {
                  momentField = node as HTMLInputElement;
                }),
                on("input", (event) => {
                  moment = event.currentTarget.value;
                }),
                // Snap a typed moment onto the step once it is complete.
                on("change", (event) => {
                  const at = new Date(event.currentTarget.value).getTime();
                  if (isNaN(at) || at % STEP_MS === 0) return;
                  setMoment(at);
                  handle.update();
                }),
              ]}
            />
          </label>
          <div mix={rowStyle}>
            {PRESETS.map(([label, ms]) => (
              <button
                type="button"
                mix={[
                  ghostButtonStyle,
                  on("click", () => {
                    setMoment(Date.now() + ms);
                    handle.update();
                  }),
                ]}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={outcome.kind === "busy"}
            mix={[buttonStyle, on("click", seal)]}
          >
            Seal message
          </button>
        </section>

        <section mix={cardStyle} aria-label="Open">
          <h2 mix={stepStyle}>2. Open</h2>
          {sealed
            ? (
              <>
                <p>
                  Sealed for <strong>{formatLocal(sealed.id)}</strong> (identity
                  {" "}
                  <code>{sealed.id}</code>).
                </p>
                <label mix={fieldStyle}>
                  Ciphertext (base64)
                  <textarea
                    rows={4}
                    readOnly
                    value={sealed.ciphertext}
                    mix={inputStyle}
                  />
                </label>
                <div mix={rowStyle}>
                  <button
                    type="button"
                    disabled={outcome.kind === "busy"}
                    mix={[buttonStyle, on("click", open)]}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on("click", forget)]}
                  >
                    Forget
                  </button>
                </div>
              </>
            )
            : <p mix={mutedStyle}>Nothing sealed yet.</p>}
          {/* Right under the buttons, so the answer to "Open" is where the click was. */}
          <Status outcome={outcome} sealed={sealed} now={now} />
        </section>

        <section mix={cardStyle} aria-label="Share">
          <h2 mix={stepStyle}>3. Share</h2>
          {sealed && (
            <>
              <fieldset mix={modeStyle}>
                <legend>Share link</legend>
                {LINK_MODES.map(([value, label, explanation]) => (
                  <label key={value} mix={modeOptionStyle}>
                    <input
                      type="radio"
                      name="link-mode"
                      value={value}
                      defaultChecked={mode === value}
                      mix={on("change", () => {
                        mode = value;
                        handle.update();
                      })}
                    />
                    <span>
                      <strong>{label}</strong>
                      <br />
                      <span mix={mutedStyle}>{explanation}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <p mix={postLinkStyle}>
                <a href={postLink(sealed, mode)} target="_blank">
                  {postLink(sealed, mode)}
                </a>
              </p>
            </>
          )}
          <div mix={shareStyle}>
            <span mix={mutedStyle}>
              {sealed ? "Share the sealed message:" : "Share this demo:"}
            </span>
            {/* Empty `url` shares this page; with a sealed message, its link. */}
            <share-buttons url={sealed ? postLink(sealed, mode) : ""} />
          </div>
        </section>
      </div>
    );
  },
);

function Status(
  handle: Handle<{ outcome: Outcome; sealed: Sealed | null; now: number }>,
) {
  return () => {
    const { outcome, sealed, now } = handle.props;
    switch (outcome.kind) {
      case "none":
        return null;
      case "busy":
        return <p role="status" mix={mutedStyle}>{outcome.text}</p>;
      case "locked": {
        const left = sealed ? Date.parse(sealed.id) - now : 0;
        return (
          <p role="status" mix={lockedStyle}>
            🔒 The server says it is not the time yet. {left > 0
              ? `${formatDuration(left)} to go.`
              : "It should be now — try again."}
          </p>
        );
      }
      case "opened":
        return (
          <div role="status" mix={openedStyle}>
            <p>🔓 Opened:</p>
            <blockquote>{outcome.text}</blockquote>
          </div>
        );
      case "error":
        return <p role="alert" mix={errorStyle}>{outcome.text}</p>;
    }
  };
}

/** The link to share a sealed message by, of the chosen kind. */
function postLink(sealed: Sealed, mode: LinkMode): string {
  return shareHref(
    location.origin,
    sealed.id,
    Uint8Array.fromBase64(sealed.ciphertext),
    mode,
  );
}

function readSealed(): Sealed | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return typeof value?.id === "string" &&
        typeof value?.ciphertext === "string"
      ? { id: value.id, ciphertext: value.ciphertext }
      : null;
  } catch {
    return null;
  }
}

/** A `datetime-local` value (`YYYY-MM-DDTHH:MM:SS`) in local time. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
    pad(date.getDate())
  }T${pad(date.getHours())}:${pad(date.getMinutes())}:${
    pad(date.getSeconds())
  }`;
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString();
}

const rootStyle = css({ display: "grid", gap: "1.25rem" });

const cardStyle = css({
  display: "grid",
  gap: "0.75rem",
  padding: "1.25rem",
  background: color.card,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
});

const stepStyle = css({ margin: 0, fontSize: "1.15rem" });

const fieldStyle = css({ display: "grid", gap: "0.35rem", fontWeight: 600 });

const inputStyle = css({
  font: "inherit",
  fontWeight: 400,
  padding: "0.5rem 0.6rem",
  color: color.fg,
  background: color.bg,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  width: "100%",
});

const rowStyle = css({ display: "flex", flexWrap: "wrap", gap: "0.5rem" });

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
  "&:disabled": { opacity: 0.6, cursor: "progress" },
});

const ghostButtonStyle = css({
  font: "inherit",
  cursor: "pointer",
  padding: "0.3rem 0.75rem",
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: "transparent",
  color: color.fg,
});

const mutedStyle = css({ color: color.muted, margin: 0 });

const lockedStyle = css({ margin: 0, fontWeight: 600 });

const openedStyle = css({
  "& p": { margin: 0, fontWeight: 600 },
  "& blockquote": {
    margin: "0.5rem 0 0",
    padding: "0.5rem 1rem",
    borderLeft: `3px solid ${color.accent}`,
    whiteSpace: "pre-wrap",
  },
});

const errorStyle = css({ margin: 0, color: color.danger });

const modeStyle = css({
  display: "grid",
  gap: "0.5rem",
  margin: 0,
  padding: "0.75rem 1rem",
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  "& legend": { fontWeight: 600, padding: "0 0.25rem" },
});

const modeOptionStyle = css({
  display: "flex",
  alignItems: "start",
  gap: "0.5rem",
  fontSize: "0.9rem",
  cursor: "pointer",
  "& input": { marginTop: "0.3rem" },
});

const postLinkStyle = css({
  margin: 0,
  fontSize: "0.85rem",
  overflowWrap: "anywhere",
  color: color.muted,
});

const shareStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.75rem",
});
