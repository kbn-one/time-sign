/**
 * The demo: seal a message for a moment, then try to open it.
 *
 * Sealing fetches the master public key and encrypts in the page with the time-sign client
 * (`/client.js`, imported on first use). Opening fetches `/at/<moment>`: before the moment the
 * server answers "It is not the time", after it the user secret key, which decrypts the message.
 *
 * The moment is the identity, so it is fixed to the one spelling the server issues keys for —
 * `timeId()`, rounded up to 10 seconds — when sealing, and opening asks for exactly that string. The sealed message is kept in `localStorage`.
 */

import {
  clientEntry,
  css,
  type Handle,
  on,
  ref,
  type RemixNode,
  type SerializableValue,
} from "remix/component";

import "../share_buttons.ts";
import {
  formatDuration,
  formatMoment,
  type Lang,
  messages,
  timeZoneLabel,
} from "../i18n.ts";
import { renderMessage } from "../message_view.ts";
import { routes } from "../routes.ts";
import { isMoment, type LinkMode, shareHref } from "../site.ts";
import { fetchKey, loadClient } from "../time_sign_client.ts";
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
  | { kind: "opened"; node: RemixNode }
  | { kind: "error"; text: string };

const STORAGE_KEY = "time-sign-demo";

/** The two kinds of share link, in the order they are offered (`linkModes` in `i18n.ts`). */
const LINK_MODES: LinkMode[] = ["private", "card"];

/** Keys are issued every 10 seconds (`TIME_STEP_MS` in `client/time_id.ts`). */
const STEP_MS = 10_000;

export interface TimeLockDemoProps {
  lang: Lang;
  [key: string]: SerializableValue;
}

export const TimeLockDemo = clientEntry(
  import.meta.url,
  function TimeLockDemo(handle: Handle<TimeLockDemoProps>) {
    const lang = handle.props.lang;
    const m = messages[lang].demo;
    let message = m.defaultMessage;
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
    /** The Open panel's text: the sealed message as `# identity` and `# ciphertext` sections. */
    let sealedField: HTMLTextAreaElement | null = null;
    /** Bumped to remount the Open panel's text when sealing (or forgetting) replaces it. */
    let sealedKey = 0;
    let momentField: HTMLInputElement | null = null;
    let sealed: Sealed | null = null;
    /** Where the share link puts the ciphertext — see `LINK_MODES`. */
    let mode: LinkMode = "private";
    let outcome: Outcome = { kind: "none" };
    let now = 0;
    /** The reader's time zone, which the date field is in; known only in the browser. */
    let zone = "";

    /** Sets the moment, rounded up to the 10 s step keys are issued on, and shows it. */
    function setMoment(at: number) {
      moment = toLocalInput(new Date(Math.ceil(at / STEP_MS) * STEP_MS));
      momentKey++;
    }

    // Client only: the static build has no "now", and no storage.
    handle.queueTask(() => {
      now = Date.now();
      zone = timeZoneLabel(lang);
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
        outcome = { kind: "error", text: m.pickValid };
        handle.update();
        return;
      }
      outcome = { kind: "busy", text: m.sealing };
      handle.update();
      try {
        const { encrypt, timeId } = await loadClient();
        const response = await fetch(routes.masterPk.href());
        if (!response.ok) throw new Error(`master_pk: ${response.status}`);
        const mpk = new Uint8Array(await response.arrayBuffer());
        const id = timeId(at);
        const enc = await encrypt(mpk, id, new TextEncoder().encode(message));
        sealed = { id, ciphertext: enc.toBase64() };
        sealedKey++;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sealed));
        outcome = { kind: "none" };
      } catch (error) {
        outcome = { kind: "error", text: String(error) };
      }
      handle.update();
    }

    async function open() {
      // What the panel holds now, which may be a message pasted from elsewhere.
      const parsed = parseSealedText(sealedField?.value ?? "");
      if ("error" in parsed) {
        outcome = { kind: "error", text: m[parsed.error] };
        handle.update();
        return;
      }
      sealed = parsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sealed));
      outcome = { kind: "busy", text: m.fetchKey };
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
          outcome = {
            kind: "opened",
            node: await renderMessage(new TextDecoder().decode(plain)),
          };
        }
      } catch (error) {
        outcome = { kind: "error", text: String(error) };
      }
      handle.update();
    }

    function forget() {
      sealed = null;
      sealedKey++;
      outcome = { kind: "none" };
      localStorage.removeItem(STORAGE_KEY);
      handle.update();
    }

    return () => (
      <div mix={rootStyle}>
        <section mix={cardStyle} aria-label="Seal">
          <h2 mix={stepStyle}>{m.sealHeading}</h2>
          <label mix={fieldStyle}>
            {m.message}
            <textarea
              rows={5}
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
            <span>
              {m.openAfter}
              {zone && <span mix={zoneStyle}>{zone}</span>}
            </span>
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
            {m.presets.map(([label, ms]) => (
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
            {m.seal}
          </button>
        </section>

        <section mix={cardStyle} aria-label="Preview">
          <h2 mix={stepStyle}>{m.previewHeading}</h2>
          {sealed && (
            <p>
              {m.sealedFor[0]}
              <strong>{formatMoment(sealed.id, lang)}</strong>
              {m.sealedFor[1]}
            </p>
          )}
          <label mix={fieldStyle}>
            {m.sealedLabel}
            <textarea
              key={sealedKey}
              rows={9}
              spellcheck={false}
              placeholder={sealedText({
                id: "2030-01-01T00:00:00Z",
                ciphertext: "…",
              })}
              defaultValue={sealed ? sealedText(sealed) : ""}
              mix={[
                inputStyle,
                ref((node) => {
                  sealedField = node as HTMLTextAreaElement;
                }),
              ]}
            />
          </label>
          <div mix={rowStyle}>
            <button
              type="button"
              disabled={outcome.kind === "busy"}
              mix={[buttonStyle, on("click", open)]}
            >
              {m.open}
            </button>
            {sealed && (
              <button
                type="button"
                mix={[ghostButtonStyle, on("click", forget)]}
              >
                {m.forget}
              </button>
            )}
          </div>
          {/* Right under the buttons, so the answer to "Open" is where the click was. */}
          <Status outcome={outcome} sealed={sealed} now={now} lang={lang} />
        </section>

        <section mix={cardStyle} aria-label="Share">
          <h2 mix={stepStyle}>{m.shareHeading}</h2>
          {sealed && (
            <div role="radiogroup" aria-label="Share link" mix={modeStyle}>
              {LINK_MODES.map((value) => (
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
                    <strong>{m.linkModes[value][0]}</strong>
                    <br />
                    <span mix={mutedStyle}>{m.linkModes[value][1]}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {/* Empty `url` shares this page; with a sealed message, its link. */}
          <share-buttons url={sealed ? postLink(sealed, mode, lang) : ""} />
        </section>
      </div>
    );
  },
);

function Status(
  handle: Handle<
    { outcome: Outcome; sealed: Sealed | null; now: number; lang: Lang }
  >,
) {
  return () => {
    const { outcome, sealed, now, lang } = handle.props;
    const m = messages[lang].demo;
    switch (outcome.kind) {
      case "none":
        return null;
      case "busy":
        return <p role="status" mix={mutedStyle}>{outcome.text}</p>;
      case "locked": {
        const left = sealed ? Date.parse(sealed.id) - now : 0;
        return (
          <p role="status" mix={lockedStyle}>
            {left > 0 ? m.locked(formatDuration(left, lang)) : m.lockedNow}
          </p>
        );
      }
      case "opened":
        return (
          <div role="status" mix={openedStyle}>
            <p>{m.opened}</p>
            <blockquote>{outcome.node}</blockquote>
          </div>
        );
      case "error":
        return <p role="alert" mix={errorStyle}>{outcome.text}</p>;
    }
  };
}

/** The link to share a sealed message by, of the chosen kind. */
function postLink(sealed: Sealed, mode: LinkMode, lang: Lang): string {
  return shareHref(
    location.origin,
    sealed.id,
    Uint8Array.fromBase64(sealed.ciphertext),
    mode,
    lang,
  );
}

/** A sealed message as the Open panel shows it. */
function sealedText(sealed: Sealed): string {
  return `# identity\n${sealed.id}\n\n# ciphertext\n${sealed.ciphertext}\n`;
}

/**
 * The Open panel's text back into a sealed message: a `# identity` section holding the moment, a
 * `# ciphertext` section holding base64 or base64url (line breaks and spaces ignored).
 */
function parseSealedText(
  text: string,
): Sealed | { error: "badIdentity" | "emptyCiphertext" | "badCiphertext" } {
  const sections: Record<string, string> = {};
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^#\s*(\w+)/);
    if (header) current = header[1].toLowerCase();
    else if (current) sections[current] = (sections[current] ?? "") + line;
  }
  const id = sections.identity?.trim() ?? "";
  if (!isMoment(id)) {
    return { error: "badIdentity" };
  }
  const raw = (sections.ciphertext ?? "").replace(/\s+/g, "");
  if (!raw) return { error: "emptyCiphertext" };
  try {
    const bytes = Uint8Array.fromBase64(
      raw.replaceAll("-", "+").replaceAll("_", "/"),
    );
    return { id, ciphertext: bytes.toBase64() };
  } catch {
    return { error: "badCiphertext" };
  }
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

const zoneStyle = css({
  marginLeft: "0.5rem",
  fontWeight: 400,
  color: color.muted,
  fontSize: "0.85rem",
});

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
  "& > p": { margin: 0, fontWeight: 600 },
  "& blockquote": {
    margin: "0.5rem 0 0",
    padding: "0.5rem 1rem",
    borderLeft: `3px solid ${color.accent}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  "& blockquote > :first-child": { marginTop: 0 },
  "& blockquote > :last-child": { marginBottom: 0 },
  "& blockquote p, & blockquote ul, & blockquote ol, & blockquote pre": {
    margin: "0.5em 0",
  },
  "& blockquote pre": { whiteSpace: "pre-wrap" },
});

const errorStyle = css({ margin: 0, color: color.danger });

const modeStyle = css({ display: "grid", gap: "0.5rem" });

const modeOptionStyle = css({
  display: "flex",
  alignItems: "start",
  gap: "0.5rem",
  fontSize: "0.9rem",
  cursor: "pointer",
  "& input": { marginTop: "0.3rem" },
});
