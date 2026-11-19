import { type Handle } from "remix/component";

import type { Lang } from "../i18n.ts";
import { TimeLockDemo } from "../islands/time_lock_demo.tsx";
import { routes } from "../routes.ts";

export const title: Record<Lang, string> = {
  ja: "デモ — time-sign",
  en: "Demo — time-sign",
};
export const description: Record<Lang, string> = {
  ja:
    "ブラウザの中で未来の日時に向けてメッセージを封印し、その時が来たら開封します。",
  en:
    "Encrypt a message for a moment in the future in your browser, then open it once that moment has passed.",
};
export const hydrate = true;

export default function Demo(handle: Handle<{ lang: Lang }>) {
  return () => {
    const { lang } = handle.props;
    return lang === "ja"
      ? (
        <>
          <h1>デモ</h1>
          <p>
            日時を選んでメッセージを封印し、開封を試してみてください。暗号化は
            {" "}
            <code>{routes.masterPk.href()}</code>{" "}
            の公開鍵を使ってこのページの中で行い、開封するときは{" "}
            <code>/at/&lt;時刻&gt;</code>{" "}
            に鍵を問い合わせます。サーバーはその時刻を過ぎるまで鍵を出しません。封印したメッセージはこのブラウザに保存されるので、後でまた開けます。
          </p>
          <TimeLockDemo lang={lang} />
        </>
      )
      : (
        <>
          <h1>Demo</h1>
          <p>
            Pick a moment, seal a message for it, and try to open it. Encryption
            happens in this page with the public key from{" "}
            <code>{routes.masterPk.href()}</code>; opening asks{" "}
            <code>/at/&lt;moment&gt;</code>{" "}
            for the key, which the server only releases once the moment has
            passed. The sealed message is kept in this browser, so you can come
            back later.
          </p>
          <TimeLockDemo lang={lang} />
        </>
      );
  };
}
