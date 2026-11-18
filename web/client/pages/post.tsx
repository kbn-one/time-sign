import { type Handle } from "remix/component";

import type { Lang } from "../i18n.ts";
import { SealedMessage } from "../islands/sealed_message.tsx";

/** One page for every link: its `<title>` and card are `postMeta(lang)` (`site.ts`). */
export const hydrate = true;

export default function Post(handle: Handle<{ lang: Lang }>) {
  return () => {
    const { lang } = handle.props;
    return lang === "ja"
      ? (
        <>
          <h1>封印されたメッセージ</h1>
          <p>
            このメッセージは時限暗号で封印されています。開封の鍵はその時刻を過ぎてから公開されます。誰にでも公開されますが、その時が来るまでは誰にも出ません。メッセージ本体はこのリンクの中にあります（プライベートリンクなら
            {" "}
            <code>#</code> の後ろにあり、ブラウザの外へは出ません）。
          </p>
          <SealedMessage lang={lang} />
        </>
      )
      : (
        <>
          <h1>A sealed message</h1>
          <p>
            This message is time-lock encrypted: the key to open it is released
            only once its moment has passed — to anyone, but not a moment
            before. The message itself is in this link: after the <code>#</code>
            {" "}
            in a private link, which never leaves your browser, or in the query
            of a link made for X's card.
          </p>
          <SealedMessage lang={lang} />
        </>
      );
  };
}
