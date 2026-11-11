import { BitkitError } from '../errors.js';
import { BECH32_CHARSET, decodeUtf8, toHex } from '../encoding.js';
import type { Network } from '../network.js';
import type { Msat } from '../units/amount.js';

/** Display-level view of a BOLT12 offer (`lno1…`). Signatures/paths are not validated. */
export interface Bolt12Offer {
  offer: string;
  /** Networks listed in offer_chains (mainnet when absent). */
  networks: Network[];
  description?: string;
  issuer?: string;
  /** Amount in msat when no currency is set. */
  amountMsat?: Msat;
  /** ISO 4217 currency when amount is in fiat minor units. */
  currency?: string;
  /** Amount in currency minor units when `currency` is set. */
  currencyAmount?: bigint;
  /** Unix seconds. */
  absoluteExpiry?: number;
  quantityMax?: bigint;
  issuerId?: string;
}

export type Bolt12Kind = 'offer' | 'invoice-request' | 'invoice';

const PREFIXES: Record<string, Bolt12Kind> = {
  lno: 'offer',
  lnr: 'invoice-request',
  lni: 'invoice',
};

/** Genesis hashes in internal byte order (as used by BOLT12 chain_hash). */
const CHAIN_HASHES: Record<string, Network> = Object.fromEntries(
  (
    [
      ['000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', 'mainnet'],
      ['000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943', 'testnet'],
      ['00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043', 'testnet4'],
      ['00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6', 'signet'],
      ['0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206', 'regtest'],
    ] as const
  ).map(([h, n]) => [h.match(/../g)!.reverse().join(''), n]),
);

/** Remove BOLT12 '+' line continuations and whitespace. */
const normalize = (s: string) =>
  s
    .trim()
    .replace(/^lightning:/i, '')
    .replace(/\+\s*/g, '')
    .replace(/\s+/g, '');

export function bolt12Kind(input: string): Bolt12Kind | null {
  const s = normalize(input).toLowerCase();
  const m = /^(lno|lnr|lni)1/.exec(s);
  return m ? PREFIXES[m[1]!]! : null;
}

export const looksLikeBolt12Offer = (s: string) => bolt12Kind(s) === 'offer';

function toBytes(data: string): Uint8Array {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const c of data) {
    const v = BECH32_CHARSET.indexOf(c);
    if (v < 0)
      throw new BitkitError('invalid-characters', 'This offer contains invalid characters.');
    acc = ((acc << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function readBigSize(b: Uint8Array, o: number): [bigint, number] {
  const first = b[o];
  if (first === undefined) throw new RangeError('eof');
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (first < 0xfd) return [BigInt(first), o + 1];
  if (first === 0xfd) return [BigInt(view.getUint16(o + 1)), o + 3];
  if (first === 0xfe) return [BigInt(view.getUint32(o + 1)), o + 5];
  return [view.getBigUint64(o + 1), o + 9];
}

const tu64 = (v: Uint8Array) => v.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);

/** Decode the display fields of a BOLT12 offer. Throws `BitkitError`. */
export function decodeBolt12Offer(input: string): Bolt12Offer {
  const offer = normalize(input);
  if (offer !== offer.toLowerCase() && offer !== offer.toUpperCase()) {
    throw new BitkitError('mixed-case', 'This offer is invalid.');
  }
  const s = offer.toLowerCase();
  if (!s.startsWith('lno1')) throw new BitkitError('invalid-offer', 'This is not a BOLT12 offer.');
  const out: Bolt12Offer = { offer: s, networks: ['mainnet'] };
  try {
    const bytes = toBytes(s.slice(4));
    let o = 0;
    while (o < bytes.length) {
      const [type, o1] = readBigSize(bytes, o);
      const [len, o2] = readBigSize(bytes, o1);
      const end = o2 + Number(len);
      if (end > bytes.length) throw new RangeError('truncated');
      const v = bytes.subarray(o2, end);
      o = end;
      switch (Number(type)) {
        case 2: {
          const nets: Network[] = [];
          for (let i = 0; i + 32 <= v.length; i += 32) {
            const n = CHAIN_HASHES[toHex(v.subarray(i, i + 32))];
            if (n) nets.push(n);
          }
          out.networks = nets;
          break;
        }
        case 6:
          out.currency = decodeUtf8(v);
          break;
        case 8:
          out.currencyAmount = tu64(v);
          break;
        case 10:
          out.description = decodeUtf8(v);
          break;
        case 14:
          out.absoluteExpiry = Number(tu64(v));
          break;
        case 18:
          out.issuer = decodeUtf8(v);
          break;
        case 20:
          out.quantityMax = tu64(v);
          break;
        case 22:
          out.issuerId = toHex(v);
          break;
        default:
          break;
      }
    }
  } catch (e) {
    if (e instanceof BitkitError) throw e;
    throw new BitkitError('invalid-offer', 'This offer is malformed.', { cause: e });
  }
  if (out.currencyAmount !== undefined && !out.currency) {
    out.amountMsat = out.currencyAmount;
    delete out.currencyAmount;
  }
  return out;
}
