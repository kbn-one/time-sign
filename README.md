# time-sign

Time-lock encryption server based on identity-based KEM (CGW-KV). Anyone can
encrypt data for a future date with the master public key; the server hands out
the decryption key for a date only after that date has passed.

```ts
import {
  decrypt,
  encrypt,
} from "https://raw.githubusercontent.com/kbn-one/time-sign/main/client/mod.ts";

const server = "https://time-sign.kbn.one";
const time = "2023-04-01";

const mpk = new Uint8Array(
  await (await fetch(server + "/master_pk")).arrayBuffer(),
);
const enc = await encrypt(mpk, time, new TextEncoder().encode("秘密"));

// after `time` has passed
const usk = new Uint8Array(
  await (await fetch(server + `/at/${time}`)).arrayBuffer(),
);
console.log(new TextDecoder().decode(await decrypt(usk, enc)));
```

## Master key

The master key pair is generated in GitHub Actions by
[`keygen.yml`](.github/workflows/keygen.yml). The secret key goes straight from
the job to the Cloudflare Worker secret and is never committed, printed or kept
in GitHub. The public key is published as a GitHub Release asset with a signed
build provenance attestation
([actions/attest](https://github.com/actions/attest)), so you can check that the
key served by the server was produced by that workflow:

```sh
curl -sSo master_pk.bin https://time-sign.kbn.one/master_pk
gh attestation verify master_pk.bin -R kbn-one/time-sign \
  --signer-workflow kbn-one/time-sign/.github/workflows/keygen.yml
```

## Site

<https://time-sign.kbn.one/> has a landing page and a
[demo](https://time-sign.kbn.one/demo) that seals a message in the browser and
opens it once its moment has passed. `/time-sign.js` is `client/mod.ts` bundled
for the browser (the WebAssembly is inlined). The API allows any origin (CORS).

## Development

Deno + Remix v3 (`remix/router`, `remix/component`), laid out after
[kuboon/deno-remix-tmpl](https://github.com/kuboon/deno-remix-tmpl):

- `web/client/` — routes, layout, pages and the demo island (browser code)
- `web/server/api.ts` — the API (`/master_pk`, `/at/<date>`)
- `web/server/router.tsx` — the whole site for `deno serve`, the tests and the
  static build
- `web/server/worker.ts` — the Cloudflare Worker (API only)

```sh
deno task wasmbuild          # rebuild lib/ from rs_lib/
deno task build:lib          # rebuild client/mod.js (served as /time-sign.js)
deno task check              # type check, lint, format
deno task test
deno task genkey ./tmp-key   # local key pair (tmp-key/secrets.json)
IBKEM_PUBLIC_KEY=... IBKEM_SECRET_KEY=... deno task dev
```

## Deploy (Cloudflare Workers)

`deno task build:cf` writes the pages as static files (`@remix-kbn/ssg`) and
bundles the Worker, arranged for `deno task cf deploy --prebuilt`. Cloudflare
serves the pages as static assets and sends only `/master_pk` and `/at/*` to the
Worker.

Repository secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ACCOUNT_ID`.

- Pushes to `main` deploy the code only; existing key secrets are kept.
- Run the **Generate master key** workflow (input `rotate`) for the first deploy
  and to rotate the key. Rotation makes old ciphertexts undecryptable.
