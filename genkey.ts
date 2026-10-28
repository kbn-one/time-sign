// Generates a new IBKEM master key pair.
//   deno task genkey <out_dir>
// Writes:
//   <out_dir>/master_pk.bin  raw master public key (same bytes as GET /master_pk)
//   <out_dir>/secrets.json   { IBKEM_PUBLIC_KEY, IBKEM_SECRET_KEY } for `cf deploy --secrets-file`
import { setup } from "./lib/rs_lib.js";

const outDir = Deno.args[0];
if (!outDir) {
  console.error("usage: deno task genkey <out_dir>");
  Deno.exit(1);
}

const [pk, sk]: [string, string] = setup();
await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/master_pk.bin`, Uint8Array.fromBase64(pk));
await Deno.writeTextFile(
  `${outDir}/secrets.json`,
  JSON.stringify({ IBKEM_PUBLIC_KEY: pk, IBKEM_SECRET_KEY: sk }),
  { mode: 0o600 },
);
console.log(`Key pair written to ${outDir}`);
