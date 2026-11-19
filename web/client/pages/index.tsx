import { css, type Handle } from "remix/component";

import type { Lang } from "../i18n.ts";
import { REPOSITORY_URL } from "../layout.tsx";
import { pagesFor, routes } from "../routes.ts";
import { color, radius } from "../tokens.ts";

export const title: Record<Lang, string> = {
  ja: "time-sign — 時限暗号",
  en: "time-sign — time-lock encryption",
};
export const description: Record<Lang, string> = {
  ja:
    "未来の日時に向けてデータを暗号化。誰でも暗号化でき、復号の鍵はその日時を過ぎてから公開されます。",
  en:
    "Encrypt data for a future date. Anyone can encrypt; the key to decrypt is released only after that date has passed.",
};
export const hydrate = false;

/** The client bundle (`client/mod.js`) of a release tag, served by jsDelivr with CORS. */
const CLIENT_URL =
  "https://cdn.jsdelivr.net/gh/kbn-one/time-sign@v1.0.0/client/mod.js";
/** The same client as TypeScript source, for Deno with types. */
const CLIENT_TS_URL =
  "https://raw.githubusercontent.com/kbn-one/time-sign/v1.0.0/client/mod.ts";

const example = `import { decrypt, encrypt, timeId } from "${CLIENT_URL}";

const server = "https://time-sign.kbn.one";
const id = timeId("2030-01-01"); // "2030-01-01T00:00:00Z"

const mpk = new Uint8Array(
  await (await fetch(server + "/master_pk")).arrayBuffer(),
);
const enc = await encrypt(mpk, id, new TextEncoder().encode("secret"));

// after the moment has passed
const usk = new Uint8Array(
  await (await fetch(server + \`/at/\${id}\`)).arrayBuffer(),
);
console.log(new TextDecoder().decode(await decrypt(usk, enc)));`;

const verify = `curl -sSo master_pk.bin https://time-sign.kbn.one/master_pk
gh attestation verify master_pk.bin -R kbn-one/time-sign \\
  --signer-workflow kbn-one/time-sign/.github/workflows/keygen.yml`;

export default function Home(handle: Handle<{ lang: Lang }>) {
  return () => handle.props.lang === "ja" ? <Japanese /> : <English />;
}

function Japanese(_handle: Handle) {
  const demo = pagesFor("ja").demo.href();
  return () => (
    <>
      <section mix={heroStyle}>
        <h1 mix={heroTitleStyle}>未来へメッセージを送る。</h1>
        <p mix={leadStyle}>
          time-sign
          は時限暗号のサーバーです。公開鍵を使えば、誰でも未来の日時に向けてデータを暗号化できます（サーバーへの問い合わせは不要）。復号の鍵は、その日時を過ぎてから公開されます。
        </p>
        <p>
          <a href={demo} mix={buttonStyle}>デモを試す</a>
        </p>
      </section>

      <section>
        <h2>仕組み</h2>
        <ol>
          <li>
            サーバーは ID ベース暗号（IBE）のマスター鍵ペアを持っています。ID
            は時刻で、10 秒単位に切り上げた 1 通りの表記{" "}
            <code>2030-01-01T00:00:00Z</code> を使います。
          </li>
          <li>
            マスター公開鍵と時刻を使い、手元で暗号化します。手元から出ていくのは暗号文だけで、このサーバーに送る必要もありません。
          </li>
          <li>
            その時刻を過ぎると、サーバーはその ID
            のユーザー秘密鍵を公開します。それより前は拒否します。
          </li>
        </ol>
        <p>
          方式は ID ベース KEM の CGW-KV で、データ本体はカプセル化した鍵による
          AES-CBC で暗号化します。
        </p>
      </section>

      <section>
        <h2>API</h2>
        <dl mix={apiStyle}>
          <dt>
            <code>GET {routes.masterPk.href()}</code>
          </dt>
          <dd>マスター公開鍵（生のバイト列）。</dd>
          <dt>
            <code>GET /at/&lt;時刻&gt;</code>
          </dt>
          <dd>
            <code>&lt;時刻&gt;</code>{" "}
            を過ぎていれば、その時刻のユーザー秘密鍵（生のバイト列）。過ぎる前は
            {" "}
            <code>It is not the time</code>{" "}
            というテキスト。鍵は 10 秒ごとに、UTC の{" "}
            <code>YYYY-MM-DDTHH:MM:SSZ</code>{" "}
            という 1 通りの表記に対してだけ発行します。<code>Date.parse</code>
            {" "}
            が読めるそれ以外の表記は、切り上げた時刻へ <code>301</code>{" "}
            でリダイレクトします（<code>/at/2030-01-01</code> →{" "}
            <code>
              /at/2030-01-01T00:00:00Z
            </code>）。そのため鍵が早く出ることはありません。暗号化にもこの表記を使ってください（クライアントの
            {" "}
            <code>timeId()</code> で得られます）。読めない日付は{" "}
            <code>400</code> です。
          </dd>
        </dl>
        <p>CORS は全許可です。どのオリジンのブラウザからも呼べます。</p>
      </section>

      <section>
        <h2>使い方</h2>
        <pre><code>{example}</code></pre>
        <p>
          読み込むのはクライアント（<code>client/mod.ts</code>）を 1 つの ES
          モジュールにまとめたもの（WebAssembly を内蔵）で、ブラウザでも Deno
          でもそのまま動きます。Deno で型を付けたいときは{" "}
          <code>{CLIENT_TS_URL}</code> を import してください。
        </p>
      </section>

      <section>
        <h2>信頼性</h2>
        <p>
          マスター鍵ペアは GitHub Actions
          のジョブの中で生成しています。秘密鍵はそのジョブから直接サーバーへ渡り、コミット・出力・GitHub
          への保存はされません。公開鍵は署名付きのビルド来歴（attestation）とともに公開しているので、このサーバーが配る鍵がそのワークフローで生成されたものか確かめられます:
        </p>
        <pre><code>{verify}</code></pre>
        <p>
          <a href={REPOSITORY_URL}>GitHub でソースコードを見る</a>
        </p>
      </section>
    </>
  );
}

function English(_handle: Handle) {
  const demo = pagesFor("en").demo.href();
  return () => (
    <>
      <section mix={heroStyle}>
        <h1 mix={heroTitleStyle}>Send a message to the future.</h1>
        <p mix={leadStyle}>
          time-sign is a time-lock encryption server. Anyone can encrypt data
          for a date with its public key — without asking the server — and the
          key that decrypts it is published only once that date has passed.
        </p>
        <p>
          <a href={demo} mix={buttonStyle}>Try the demo</a>
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <ol>
          <li>
            The server holds an identity-based encryption (IBE) master key pair.
            The identity is a moment, spelled one way and rounded up to 10
            seconds: <code>2030-01-01T00:00:00Z</code>.
          </li>
          <li>
            You encrypt locally with the master public key and the date. Only
            the ciphertext leaves your hands — and it never has to reach this
            server.
          </li>
          <li>
            After the date, the server hands out the user secret key for that
            identity. Before it, it refuses.
          </li>
        </ol>
        <p>
          The scheme is CGW-KV, an identity-based KEM; the data itself is
          encrypted with AES-CBC under the encapsulated key.
        </p>
      </section>

      <section>
        <h2>API</h2>
        <dl mix={apiStyle}>
          <dt>
            <code>GET {routes.masterPk.href()}</code>
          </dt>
          <dd>The master public key, as raw bytes.</dd>
          <dt>
            <code>GET /at/&lt;moment&gt;</code>
          </dt>
          <dd>
            The user secret key for <code>&lt;moment&gt;</code>{" "}
            once it has passed, as raw bytes; before that, the text{" "}
            <code>It is not the time</code>. Keys are issued every 10 seconds,
            for one spelling: <code>YYYY-MM-DDTHH:MM:SSZ</code>{" "}
            in UTC. Any other date <code>Date.parse</code> accepts is a{" "}
            <code>301</code> to that moment rounded up (<code>
              /at/2030-01-01
            </code>{" "}
            →{" "}
            <code>/at/2030-01-01T00:00:00Z</code>), so a key is never released
            early. Encrypt for that spelling: the client's <code>timeId()</code>
            {" "}
            gives it. An unparseable date is <code>400</code>.
          </dd>
        </dl>
        <p>CORS is open: any origin may call the API from a browser.</p>
      </section>

      <section>
        <h2>Use it</h2>
        <pre><code>{example}</code></pre>
        <p>
          This is the client (<code>client/mod.ts</code>) bundled as one ES
          module, with the WebAssembly inlined: it runs as is in a browser or
          Deno. For types in Deno, import <code>{CLIENT_TS_URL}</code> instead.
        </p>
      </section>

      <section>
        <h2>Trust</h2>
        <p>
          The master key pair is generated inside a GitHub Actions job. The
          secret key goes straight from that job to the server and is never
          committed, printed or stored in GitHub; the public key is published
          with a signed build provenance attestation, so you can check the key
          this server hands out was produced by that workflow:
        </p>
        <pre><code>{verify}</code></pre>
        <p>
          <a href={REPOSITORY_URL}>Read the source on GitHub.</a>
        </p>
      </section>
    </>
  );
}

const heroStyle = css({ paddingBlock: "2rem 1rem" });

const heroTitleStyle = css({ fontSize: "2.25rem", margin: "0 0 0.75rem" });

const leadStyle = css({ fontSize: "1.15rem", color: color.muted });

const buttonStyle = css({
  display: "inline-block",
  padding: "0.6rem 1.2rem",
  borderRadius: radius.md,
  background: color.accent,
  color: color.onAccent,
  fontWeight: 600,
  textDecoration: "none",
});

const apiStyle = css({
  "& dt": { marginTop: "0.75rem" },
  "& dd": { marginLeft: "1.25rem", color: color.muted },
});
