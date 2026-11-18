import { css, type Handle } from "remix/component";

import { REPOSITORY_URL } from "../layout.tsx";
import { routes } from "../routes.ts";
import { color, radius } from "../tokens.ts";

export const title = "time-sign — time-lock encryption";
export const description =
  "Encrypt data for a future date. Anyone can encrypt; the key to decrypt is released only after that date has passed.";
export const hydrate = false;

const example =
  `import { decrypt, encrypt, timeId } from "https://raw.githubusercontent.com/kbn-one/time-sign/main/client/mod.ts";

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

export default function Home(_handle: Handle) {
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
          <a href={routes.demo.href()} mix={buttonStyle}>Try the demo</a>
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
          In the browser, <code>{routes.lib.href()}</code>{" "}
          is the same client bundled as one ES module (the WebAssembly is
          inlined).
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
