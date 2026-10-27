import { decaps, encaps } from "../lib/rs_lib.js";
import { decodeBase64 } from "@std/encoding/base64";
import * as msgpack from "@std/msgpack";

export function missingFeature() {
  if (typeof Deno != "undefined") return null;
  if (typeof crypto == "undefined") return "crypto";
  const { subtle } = crypto;
  if (!subtle) return "crypto.subtle";
  if (!subtle.generateKey) return "crypto.subtle.generateKey";
  if (!subtle.encrypt) return "crypto.subtle.encrypt";
  if (!subtle.decrypt) return "crypto.subtle.decrypt";
  if (!subtle.wrapKey) return "crypto.subtle.wrapKey";
  if (!subtle.unwrapKey) return "crypto.subtle.unwrapKey";
  if (!subtle.importKey) return "crypto.subtle.importKey";
  if (!subtle.exportKey) return "crypto.subtle.exportKey";
  if (!crypto.getRandomValues) return "crypto.getRandomValues";
  return null;
}
const subtle = globalThis.crypto?.subtle;

type EncData = {
  ct: Uint8Array;
  iv: Uint8Array;
  encrypted: Uint8Array;
};

export async function encrypt(
  mpk: Uint8Array,
  id: string,
  plain: Uint8Array,
): Promise<Uint8Array> {
  const [ct_, ss_] = await encaps(mpk, id);
  const ct = decodeBase64(ct_);
  const ss = decodeBase64(ss_);
  const aeskey = await subtle.importKey(
    "raw",
    ss as BufferSource,
    "AES-CBC",
    true,
    ["encrypt"],
  );
  const iv: Uint8Array = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = new Uint8Array(
    await aesEncrypt(aeskey, iv as BufferSource, plain as BufferSource),
  );
  return msgpack.encode({ ct, iv, encrypted });
}

export async function decrypt(
  usk: Uint8Array,
  enc: Uint8Array,
): Promise<ArrayBuffer> {
  const { ct, iv, encrypted } = msgpack.decode(enc) as EncData;
  const ss = await decaps(usk, ct);
  const aeskey = await subtle.importKey(
    "raw",
    ss as BufferSource,
    "AES-CBC",
    true,
    ["decrypt"],
  );
  return aesDecrypt(aeskey, iv as BufferSource, encrypted as BufferSource);
}

function aesEncrypt(key: CryptoKey, iv: BufferSource, plain: BufferSource) {
  return subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    plain,
  );
}

function aesDecrypt(
  key: CryptoKey,
  iv: BufferSource,
  encrypted: BufferSource,
) {
  return subtle.decrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    encrypted,
  ) as Promise<ArrayBuffer>;
}
