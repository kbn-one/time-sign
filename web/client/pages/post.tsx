import { type Handle } from "remix/component";

import { SealedMessage } from "../islands/sealed_message.tsx";

/** One page for every link: its `<title>` and card are `POST_META` (`site.ts`). */
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
