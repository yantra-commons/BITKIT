import { bech32, bech32m, createBase58check, hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';

export { bech32, bech32m, hex };

export const base58check = createBase58check(sha256);

export const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_RE = /^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]*$/;
export const isBech32Charset = (s: string) => CHARSET_RE.test(s);

export const toHex = (b: Uint8Array) => hex.encode(b);

/** Convert 5-bit words to bytes, dropping incomplete trailing bits (BOLT11/12 style). */
export function wordsToBytes(words: readonly number[]): Uint8Array {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const w of words) {
    acc = ((acc << 5) | w) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** Interpret 5-bit words as a big-endian unsigned integer. */
export function wordsToInt(words: readonly number[]): number {
  let n = 0;
  for (const w of words) n = n * 32 + w;
  return n;
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
/** Strict UTF-8 decode; throws on invalid input. */
export const decodeUtf8 = (b: Uint8Array) => utf8.decode(b);
export const encodeUtf8 = (s: string) => new TextEncoder().encode(s);
