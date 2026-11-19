import { type Handle } from "remix/component";

import type { Lang } from "../i18n.ts";
import { SealedCard } from "../islands/sealed_card.tsx";

export const title: Record<Lang, string> = {
  ja: "封印されたメッセージ — time-sign",
  en: "A sealed message — time-sign",
};
export const description: Record<Lang, string> = {
  ja: "時限暗号で封印されたメッセージのカウントダウン。",
  en: "The countdown of a time-lock encrypted message.",
};
export const hydrate = true;

/** The X player card's frame: the card alone, no site around it (`bare`). */
export default function Embed(handle: Handle<{ lang: Lang }>) {
  return () => <SealedCard lang={handle.props.lang} />;
}
