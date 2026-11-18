import { type Handle } from "remix/component";

import { SealedCard } from "../islands/sealed_card.tsx";

export const title = "A sealed message — time-sign";
export const description = "The countdown of a time-lock encrypted message.";
export const hydrate = true;

/** The X player card's frame: the card alone, no site around it (`bare`). */
export default function Embed(_handle: Handle) {
  return () => <SealedCard />;
}
