import { BitkitError } from '../errors.js';
import { formatDecimal, parseDecimal, pow10, divRound, type Rounding } from './decimal.js';

/**
 * All amounts in core are bigint **millisatoshis** (msat). Lightning needs msat precision;
 * on-chain values are whole sats (msat divisible by 1000).
 */
export type Msat = bigint;

/** Units a user can enter or display. `bits` = µBTC = 100 sats. */
export type BitcoinUnit = 'btc' | 'mbtc' | 'bits' | 'sat' | 'msat';

/** Number of decimal places between the unit and msat. */
export const UNIT_DECIMALS: Readonly<Record<BitcoinUnit, number>> = {
  btc: 11,
  mbtc: 8,
  bits: 5,
  sat: 3,
  msat: 0,
};

export const MSAT_PER_SAT = 1000n;
export const SATS_PER_BTC = 100_000_000n;
export const MSAT_PER_BTC = SATS_PER_BTC * MSAT_PER_SAT;
/** 21 million BTC in msat — upper bound for any sane amount. */
export const MAX_MSAT = 21_000_000n * MSAT_PER_BTC;

export type AmountLike = bigint | string | number;

/**
 * Convert an amount in `unit` to msat. Strings are parsed as exact decimals; numbers are
 * accepted only when they are safe integers (pass decimals as strings).
 */
export function toMsat(value: AmountLike, unit: BitcoinUnit, rounding: Rounding = 'reject'): Msat {
  const decimals = UNIT_DECIMALS[unit];
  if (typeof value === 'bigint') return value * pow10(decimals);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new BitkitError(
        'invalid-number',
        'Pass fractional or very large amounts as strings to avoid floating-point errors.',
      );
    }
    return BigInt(value) * pow10(decimals);
  }
  return parseDecimal(value, decimals, rounding);
}

/** Convert msat to a plain decimal string in `unit` (e.g. "0.00012345"). */
export function fromMsat(
  msat: Msat,
  unit: BitcoinUnit,
  opts: { minFractionDigits?: number; maxFractionDigits?: number } = {},
): string {
  return formatDecimal(msat, UNIT_DECIMALS[unit], opts);
}

/** Whole sats → msat. */
export const satsToMsat = (sats: AmountLike): Msat => toMsat(sats, 'sat');

/** msat → whole sats (default rounds down, i.e. never overstates a balance). */
export const msatToSats = (msat: Msat, rounding: Exclude<Rounding, 'reject'> = 'floor'): bigint =>
  divRound(msat, MSAT_PER_SAT, rounding);

/** Coerce bigint | string | number sats input (e.g. an HTML attribute) to bigint sats. */
export function toSats(value: AmountLike): bigint {
  if (typeof value === 'bigint') return value;
  const s = typeof value === 'number' ? value : value.trim();
  if (typeof s === 'string' && !/^-?\d+$/.test(s)) {
    throw new BitkitError('invalid-number', `"${value}" is not a whole number of sats.`);
  }
  if (typeof s === 'number' && !Number.isSafeInteger(s)) {
    throw new BitkitError('invalid-number', 'Sats must be a whole number.');
  }
  return BigInt(s);
}

export interface AmountBounds {
  min?: Msat;
  max?: Msat;
}

/** Validate an amount against bounds; returns null when OK, else a user-facing message code. */
export function checkAmountBounds(
  msat: Msat,
  { min, max }: AmountBounds,
): { code: 'negative' | 'out-of-range'; bound?: 'min' | 'max' } | null {
  if (msat < 0n) return { code: 'negative' };
  if (min !== undefined && msat < min) return { code: 'out-of-range', bound: 'min' };
  if (max !== undefined && msat > max) return { code: 'out-of-range', bound: 'max' };
  if (msat > MAX_MSAT) return { code: 'out-of-range', bound: 'max' };
  return null;
}

/** Sum a list of msat amounts. */
export const sumMsat = (values: Iterable<Msat>): Msat => {
  let total = 0n;
  for (const v of values) total += v;
  return total;
};
