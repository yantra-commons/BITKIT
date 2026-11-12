import { decodeAddress, type AddressInfo } from '../address/address.js';
import { OrangeError } from '../errors.js';
import type { Network } from '../network.js';
import { fromMsat, MSAT_PER_SAT, toMsat, type Msat } from '../units/amount.js';

/** Parsed BIP21 / BIP321 URI. */
export interface Bip21 {
  /** On-chain address (may be absent for Lightning-only URIs per BIP321). */
  address?: string;
  addressInfo?: AddressInfo;
  /** Requested amount in msat (BIP21 amounts are BTC with ≤ 8 decimals). */
  amountMsat?: Msat;
  label?: string;
  message?: string;
  /** BOLT11 invoice from the `lightning` parameter (unified QR). */
  lightning?: string;
  /** BOLT12 offer from the `lno` parameter. */
  offer?: string;
  /** Payjoin endpoint (`pj`). */
  payjoin?: string;
  /** All parameters, lower-cased keys, decoded values (first occurrence wins). */
  params: Record<string, string>;
}

const SCHEME = /^bitcoin:/i;
const AMOUNT_RE = /^\d+(\.\d{0,8})?$|^\.\d{1,8}$/;
const KNOWN = new Set(['amount', 'label', 'message', 'lightning', 'lno', 'pj', 'pjos', 'sp']);

export const isBip21 = (s: string) => SCHEME.test(s.trim());

function decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch (e) {
    throw new OrangeError('invalid-uri', 'This payment link is malformed.', { cause: e });
  }
}

/** Parse a `bitcoin:` URI. Throws `OrangeError` on invalid input. */
export function parseBip21(uri: string, network?: Network): Bip21 {
  const s = uri.trim();
  if (!SCHEME.test(s)) throw new OrangeError('invalid-uri', 'This is not a bitcoin: payment link.');
  const rest = s.slice('bitcoin:'.length);
  const q = rest.indexOf('?');
  const addrPart = decode(q === -1 ? rest : rest.slice(0, q));
  const query = q === -1 ? '' : rest.slice(q + 1);
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq === -1 ? pair : pair.slice(0, eq)).toLowerCase();
    const value = eq === -1 ? '' : decode(pair.slice(eq + 1));
    if (key.startsWith('req-') && !KNOWN.has(key.slice(4))) {
      throw new OrangeError(
        'unsupported-required-param',
        `This payment link requires a feature ("${key.slice(4)}") that isn't supported.`,
      );
    }
    if (!(key in params)) params[key] = value;
  }

  const out: Bip21 = { params };
  if (addrPart) {
    out.address = addrPart;
    try {
      out.addressInfo = decodeAddress(addrPart, network);
      out.address = out.addressInfo.address;
    } catch (e) {
      if (e instanceof OrangeError && e.code === 'wrong-network') throw e;
      throw new OrangeError('invalid-address', 'The address in this payment link is not valid.', {
        cause: e,
      });
    }
  }
  if (params.amount !== undefined) {
    if (!AMOUNT_RE.test(params.amount)) {
      throw new OrangeError('invalid-amount', 'The amount in this payment link is not valid.');
    }
    out.amountMsat = toMsat(params.amount, 'btc');
  }
  if (params.label) out.label = params.label;
  if (params.message) out.message = params.message;
  if (params.lightning) out.lightning = params.lightning;
  if (params.lno) out.offer = params.lno;
  if (params.pj) out.payjoin = params.pj;
  if (!out.address && !out.lightning && !out.offer && !params.sp) {
    throw new OrangeError('invalid-uri', 'This payment link has no destination.');
  }
  return out;
}

export interface BuildBip21Options {
  address?: string;
  /** Amount in msat; must be a whole number of sats for on-chain. */
  amountMsat?: Msat;
  /** Convenience: amount in sats. */
  amountSats?: bigint;
  label?: string;
  message?: string;
  lightning?: string;
  offer?: string;
  /** Extra parameters (already-decoded values). */
  params?: Record<string, string>;
  /**
   * Upper-case the scheme, bech32 address and Lightning invoice so QR encoders can use the
   * denser alphanumeric mode (Bitcoin Design Guide "unified QR" recommendation).
   */
  uppercase?: boolean;
}

const enc = (v: string) => encodeURIComponent(v);

/** Build a BIP21 / unified-QR URI. */
export function buildBip21(opts: BuildBip21Options): string {
  const upper = opts.uppercase === true;
  let address = opts.address ?? '';
  if (upper && /^(bc|tb|bcrt)1/i.test(address)) address = address.toUpperCase();
  const parts: string[] = [];
  const amount =
    opts.amountMsat ?? (opts.amountSats !== undefined ? opts.amountSats * MSAT_PER_SAT : undefined);
  if (amount !== undefined) {
    if (amount % MSAT_PER_SAT !== 0n) {
      throw new OrangeError('invalid-amount', 'On-chain amounts must be whole sats.');
    }
    parts.push(`amount=${fromMsat(amount, 'btc', { maxFractionDigits: 8 })}`);
  }
  if (opts.label) parts.push(`label=${enc(opts.label)}`);
  if (opts.message) parts.push(`message=${enc(opts.message)}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) parts.push(`${enc(k)}=${enc(v)}`);
  if (opts.lightning) {
    const ln = upper ? opts.lightning.toUpperCase() : opts.lightning;
    parts.push(`${upper ? 'LIGHTNING' : 'lightning'}=${ln}`);
  }
  if (opts.offer) {
    const lno = upper ? opts.offer.toUpperCase() : opts.offer;
    parts.push(`${upper ? 'LNO' : 'lno'}=${lno}`);
  }
  const scheme = upper ? 'BITCOIN:' : 'bitcoin:';
  return `${scheme}${address}${parts.length ? `?${parts.join('&')}` : ''}`;
}
