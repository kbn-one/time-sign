import { type Handle } from "remix/component";

import { SealedMessage } from "../islands/sealed_message.tsx";

/** The page's `<title>` and card come from `postMeta()` (`site.ts`), by the moment in `?t=`. */
export const hydrate = true;

export default function Post(_handle: Handle) {
  return () => (
    <>
      <h1>A sealed message</h1>
      <p>
        This message is time-lock encrypted: the key to open it is released only
        once its moment has passed — to anyone, but not a moment before. The
        message itself is in this link, after the{" "}
        <code>#</code>, and never leaves your browser.
      </p>
      <SealedMessage />
    </>
  );
}
