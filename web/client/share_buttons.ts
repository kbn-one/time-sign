/**
 * `<share-buttons>` from [`@kuboon/share-element`](https://jsr.io/@kuboon/share-element),
 * registered (importing it does that, wherever there is a DOM) and declared to Remix's JSX.
 *
 * An empty `url` shares the page the reader is on, read at the moment of the click — which for a
 * `/post` link includes the `#c=` fragment that carries the message.
 */

import type { HostProps } from "remix/component";
import type { ShareButtonsElement } from "@kuboon/share-element";
import "@kuboon/share-element";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "share-buttons": HostProps<ShareButtonsElement> & {
        /** What to share; empty shares the page the reader is on. */
        url?: string;
        show?: "auto" | "all";
      };
    }
  }
}
