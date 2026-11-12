import { encodeAddress } from '../address/address.js';
import { OrangeError } from '../errors.js';
import { bech32, decodeUtf8, toHex, wordsToBytes, wordsToInt } from '../encoding.js';
import type { Network } from '../network.js';
import type { Msat } from '../units/amount.js';

export interface RouteHintHop {
  pubkey: string;
  shortChannelId: string;
  feeBaseMsat: number;
  feeProportionalMillionths: number;
  cltvExpiryDelta: number;
}

/** A decoded BOLT11 invoice. Signatures are NOT verified (display-level decoder). */
export interface Bolt11Invoice {
  paymentRequest: string;
  network: Network;
  /** null when the invoice has no amount ("any amount"). */
  amountMsat: Msat | null;
  /** Unix seconds. */
  timestamp: number;
  /** Seconds until expiry from `timestamp` (default 3600). */
  expiry: number;
  /** Unix seconds when the invoice expires. */
  expiresAt: number;
  paymentHash: string;
  paymentSecret: string;
  description?: string;
  descriptionHash?: string;
  payeeNodeKey?: string;
  minFinalCltvExpiry: number;
  fallbackAddresses: string[];
  routeHints: RouteHintHop[][];
  /** Feature bit numbers that are set. */
  features: number[];
  metadata?: string;
  /** 64-byte compact signature (hex) followed by the recovery flag. */
  signature: string;
  recoveryFlag: number;
}

const PREFIX_NETWORK: Record<string, Network> = {
  bc: 'mainnet',
  tb: 'testnet',
  tbs: 'signet',
  bcrt: 'regtest',
};
const HRP_RE = /^ln(bcrt|bc|tbs|tb)(\d*)([munp]?)$/;
// msat per unit of each multiplier (p is 0.1 msat, handled separately).
const MULT: Record<string, bigint> = {
  '': 100_000_000_000n,
  m: 100_000_000n,
  u: 100_000n,
  n: 100n,
};
/** Invoice feature bits this decoder understands (BOLT 9, context "9"). */
const KNOWN_FEATURES = new Set([8, 9, 14, 15, 16, 17, 24, 25, 48, 49]);

const SIGNATURE_WORDS = 104;
const TIMESTAMP_WORDS = 7;

const fail = (
  code: ConstructorParameters<typeof OrangeError>[0],
  msg: string,
  cause?: unknown,
): never => {
  throw new OrangeError(code, msg, cause === undefined ? undefined : { cause });
};

const INVALID = 'This Lightning invoice is invalid.';

export const stripLightningPrefix = (s: string) => s.trim().replace(/^lightning:/i, '');

/** Quick check: does the string look like a BOLT11 invoice? */
export const looksLikeBolt11 = (s: string) =>
  /^ln(bcrt|bc|tbs|tb)[0-9a-z]*1/i.test(stripLightningPrefix(s));

function parseAmount(digits: string, mult: string): Msat | null {
  if (!digits && !mult) return null;
  if (!digits) return fail('invalid-amount', INVALID);
  const n = BigInt(digits);
  if (mult === 'p') {
    if (n % 10n !== 0n)
      return fail('invalid-amount', 'This invoice asks for a sub-millisatoshi amount.');
    return n / 10n;
  }
  return n * MULT[mult]!;
}

/** Decode a BOLT11 payment request. Throws `OrangeError`. */
export function decodeBolt11(input: string): Bolt11Invoice {
  const raw = stripLightningPrefix(input);
  if (!raw) fail('empty', 'Enter a Lightning invoice.');
  if (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) fail('mixed-case', INVALID);
  const pr = raw.toLowerCase();
  const sep = pr.lastIndexOf('1');
  if (sep < 1) fail('invalid-characters', INVALID);
  const hrp = pr.slice(0, sep);
  const m = HRP_RE.exec(hrp);
  if (!m) {
    if (/^ln(bcrt|bc|tbs|tb)/.test(hrp))
      fail('invalid-amount', 'This invoice has an invalid amount.');
    fail('unknown-prefix', 'This is not a Lightning invoice for a supported network.');
  }
  const [, prefix, digits = '', mult = ''] = m!;
  let words: number[];
  try {
    words = bech32.decode(pr as `${string}1${string}`, false).words;
  } catch (e) {
    return fail('invalid-checksum', 'This Lightning invoice has a typo or is incomplete.', e);
  }
  if (words.length < TIMESTAMP_WORDS + SIGNATURE_WORDS) fail('invalid-length', INVALID);

  const end = words.length - SIGNATURE_WORDS;
  const sigBytes = wordsToBytes(words.slice(end));
  const inv: Partial<Bolt11Invoice> &
    Pick<Bolt11Invoice, 'fallbackAddresses' | 'routeHints' | 'features' | 'expiry' | 'timestamp'> =
    {
      paymentRequest: pr,
      network: PREFIX_NETWORK[prefix!]!,
      amountMsat: parseAmount(digits, mult),
      timestamp: wordsToInt(words.slice(0, TIMESTAMP_WORDS)),
      expiry: 3600,
      minFinalCltvExpiry: 18,
      fallbackAddresses: [],
      routeHints: [],
      features: [],
      signature: toHex(sigBytes.subarray(0, 64)),
      recoveryFlag: sigBytes[64] ?? 0,
    };
  const seen = new Map<string, number>();
  const fixed = (tag: string, data: number[], len: number) => {
    if (data.length !== len)
      fail('invalid-field', `${INVALID} (field "${tag}" has the wrong length)`);
    if (seen.get(tag)) fail('duplicate-field', `${INVALID} (duplicate "${tag}" field)`);
    return toHex(wordsToBytes(data));
  };

  let i = TIMESTAMP_WORDS;
  while (i < end) {
    const type = words[i]!;
    const len = (words[i + 1] ?? 0) * 32 + (words[i + 2] ?? 0);
    const data = words.slice(i + 3, i + 3 + len);
    i += 3 + len;
    if (i > end) fail('invalid-length', INVALID);
    const tag = bech32CharOf(type);
    switch (tag) {
      case 'p':
        inv.paymentHash = fixed(tag, data, 52);
        break;
      case 's':
        inv.paymentSecret = fixed(tag, data, 52);
        break;
      case 'h':
        inv.descriptionHash = fixed(tag, data, 52);
        break;
      case 'n':
        inv.payeeNodeKey = fixed(tag, data, 53);
        break;
      case 'd':
        try {
          inv.description = decodeUtf8(wordsToBytes(data));
        } catch (e) {
          fail('invalid-description', 'This invoice has an unreadable description.', e);
        }
        break;
      case 'x':
        inv.expiry = wordsToInt(data);
        break;
      case 'c':
        inv.minFinalCltvExpiry = wordsToInt(data);
        break;
      case 'm':
        inv.metadata = toHex(wordsToBytes(data));
        break;
      case 'f': {
        const addr = decodeFallback(data, inv.network!);
        if (addr) inv.fallbackAddresses.push(addr);
        break;
      }
      case 'r':
        inv.routeHints.push(decodeRouteHint(wordsToBytes(data)));
        break;
      case '9':
        inv.features = decodeFeatures(data);
        break;
      default:
        break; // unknown fields are skipped
    }
    seen.set(tag, (seen.get(tag) ?? 0) + 1);
  }
  if (seen.get('p') !== 1) fail('missing-field', `${INVALID} (missing payment hash)`);
  if (seen.get('s') !== 1) fail('missing-field', `${INVALID} (missing payment secret)`);
  const d = seen.get('d') ?? 0;
  const h = seen.get('h') ?? 0;
  if (d + h !== 1) fail('missing-field', `${INVALID} (needs exactly one description)`);
  const unknownEven = inv.features.filter((f) => f % 2 === 0 && !KNOWN_FEATURES.has(f));
  if (unknownEven.length) {
    fail(
      'unknown-required-feature',
      `This invoice requires unsupported features (${unknownEven.join(', ')}).`,
    );
  }
  inv.expiresAt = inv.timestamp + inv.expiry;
  return inv as Bolt11Invoice;
}

const bech32CharOf = (w: number) => 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'[w]!;

function decodeFallback(data: number[], network: Network): string | null {
  const [version, ...rest] = data;
  if (version === undefined) return null;
  const program = wordsToBytes(rest);
  try {
    if (version === 17) return encodeAddress('p2pkh', program, network);
    if (version === 18) return encodeAddress('p2sh', program, network);
    if (version <= 16) {
      const type =
        version === 0
          ? program.length === 20
            ? 'p2wpkh'
            : 'p2wsh'
          : version === 1
            ? 'p2tr'
            : 'witness-unknown';
      return encodeAddress(type, program, network, version);
    }
  } catch {
    return null;
  }
  return null; // unknown version: MUST skip
}

function decodeRouteHint(bytes: Uint8Array): RouteHintHop[] {
  const hops: RouteHintHop[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let o = 0; o + 51 <= bytes.length; o += 51) {
    const scid = view.getBigUint64(o + 33);
    hops.push({
      pubkey: toHex(bytes.subarray(o, o + 33)),
      shortChannelId: `${scid >> 40n}x${(scid >> 16n) & 0xffffffn}x${scid & 0xffffn}`,
      feeBaseMsat: view.getUint32(o + 41),
      feeProportionalMillionths: view.getUint32(o + 45),
      cltvExpiryDelta: view.getUint16(o + 49),
    });
  }
  return hops;
}

function decodeFeatures(data: number[]): number[] {
  const bits: number[] = [];
  const total = data.length * 5;
  data.forEach((w, idx) => {
    for (let b = 0; b < 5; b++) {
      if (w & (1 << (4 - b))) bits.push(total - 1 - (idx * 5 + b));
    }
  });
  return bits.sort((a, b) => a - b);
}

/** Seconds remaining before expiry (negative once expired). */
export const secondsUntilExpiry = (inv: Pick<Bolt11Invoice, 'expiresAt'>, nowMs = Date.now()) =>
  inv.expiresAt - Math.floor(nowMs / 1000);

export const isInvoiceExpired = (inv: Pick<Bolt11Invoice, 'expiresAt'>, nowMs = Date.now()) =>
  secondsUntilExpiry(inv, nowMs) <= 0;
