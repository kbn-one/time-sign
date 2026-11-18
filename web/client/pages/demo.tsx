import { type Handle } from "remix/component";

import { TimeLockDemo } from "../islands/time_lock_demo.tsx";
import { routes } from "../routes.ts";

export const title = "Demo — time-sign";
export const description =
  "Encrypt a message for a moment in the future in your browser, then open it once that moment has passed.";
export const hydrate = true;

export default function Demo(_handle: Handle) {
  return () => (
    <>
      <h1>Demo</h1>
      <p>
        Pick a moment, seal a message for it, and try to open it. Encryption
        happens in this page with the public key from{" "}
        <code>{routes.masterPk.href()}</code>; opening asks{" "}
        <code>/at/&lt;moment&gt;</code>{" "}
        for the key, which the server only releases once the moment has passed.
        The sealed message is kept in this browser, so you can come back later.
      </p>
      <TimeLockDemo />
    </>
  );
}
