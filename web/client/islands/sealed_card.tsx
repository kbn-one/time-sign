/**
 * The X player card for a post: `/embed?t=<moment>`, in X's iframe.
 *
 * The iframe gets only what the card's `twitter:player` URL says — the moment, never the message,
 * which stays in the post link's fragment — so this counts down to the moment and then points the
 * reader at the link. It fills the frame (245–500 px wide), and links open in a new tab: the frame
 * is sandboxed, with popups allowed.
 */

import { clientEntry, css, type Handle } from "remix/component";

import { routes } from "../routes.ts";
import { formatUtc, isMoment, SITE_ORIGIN } from "../site.ts";
import { formatDuration } from "../time_sign_client.ts";
import { color } from "../tokens.ts";

export const SealedCard = clientEntry(
  import.meta.url,
  function SealedCard(handle: Handle) {
    let moment: string | null = null;
    let now = 0;
    let ready = false;

    handle.queueTask(() => {
      const t = new URLSearchParams(location.search).get("t");
      moment = isMoment(t) ? t : null;
      now = Date.now();
      ready = true;
      handle.update();
      const timer = setInterval(() => {
        now = Date.now();
        handle.update();
      }, 1000);
      handle.signal.addEventListener("abort", () => clearInterval(timer), {
        once: true,
      });
    });

    return () => {
      const left = moment ? Date.parse(moment) - now : 0;
      return (
        <div mix={frameStyle}>
          <div mix={lockStyle} aria-hidden="true">
            {ready && moment && left <= 0 ? "🔓" : "🔒"}
          </div>
          {!ready
            ? <p mix={headStyle}>A sealed message</p>
            : !moment
            ? <p mix={headStyle}>A sealed message</p>
            : left > 0
            ? (
              <>
                <p mix={headStyle}>Opens in</p>
                <p mix={countStyle}>{formatDuration(left)}</p>
                <p mix={subStyle}>
                  {new Date(moment).toLocaleString()} ({formatUtc(moment)})
                </p>
              </>
            )
            : (
              <>
                <p mix={headStyle}>It can be opened now</p>
                <p mix={subStyle}>
                  Open the link in the post to read it.
                </p>
              </>
            )}
          <p mix={brandStyle}>
            time-lock encrypted with{" "}
            <a
              href={`${SITE_ORIGIN}${routes.home.href()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              time-sign
            </a>
          </p>
        </div>
      );
    };
  },
);

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

const lockStyle = css({ fontSize: "clamp(2.5rem, 18vw, 5rem)" });

const headStyle = css({ margin: 0, fontSize: "1.2rem", fontWeight: 700 });

const countStyle = css({
  margin: 0,
  fontSize: "clamp(1.8rem, 11vw, 3rem)",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
});

const subStyle = css({ margin: 0, color: color.muted, fontSize: "0.9rem" });

const brandStyle = css({
  margin: "1rem 0 0",
  color: color.muted,
  fontSize: "0.8rem",
});
