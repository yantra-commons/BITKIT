import { OrangeError } from '../errors.js';
import { MSAT_PER_BTC, type Msat } from './amount.js';
import {
  divRound,
  formatDecimal,
  parseDecimal,
  pow10,
  toRational,
  type Rounding,
} from './decimal.js';

/**
 * Price of 1 BTC in a fiat currency. `price` should be a decimal string ("67012.55"); JSON
 * numbers are accepted and converted through their exact shortest string form.
 */
export interface FiatRate {
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  /** Price of 1 BTC. */
  price: string | number;
  /** Optional unix ms timestamp of the quote, for staleness display. */
  timestamp?: number;
}

const fractionCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (USD 2, JPY 0, BHD 3). */
export function currencyFractionDigits(currency: string): number {
  const key = currency.toUpperCase();
  let digits = fractionCache.get(key);
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat('en', { style: 'currency', currency: key }).resolvedOptions()
          .maximumFractionDigits ?? 2;
    } catch {
      throw new OrangeError('invalid-number', `Unknown currency "${currency}".`);
    }
    fractionCache.set(key, digits);
  }
  return digits;
}

export interface FiatValue {
  currency: string;
  /** Value in minor units (cents). */
  minor: bigint;
  fractionDigits: number;
  /** Plain decimal string, e.g. "12.34". */
  value: string;
}

/** Convert msat to fiat, rounded half-up to the currency's minor unit. */
export function msatToFiat(
  msat: Msat,
  rate: FiatRate,
  rounding: Exclude<Rounding, 'reject'> = 'half-up',
): FiatValue {
  const fd = currencyFractionDigits(rate.currency);
  const p = toRational(rate.price);
  if (p.num <= 0n) throw new OrangeError('out-of-range', 'Exchange rate must be positive.');
  const minor = divRound(msat * p.num * pow10(fd), p.den * MSAT_PER_BTC, rounding);
  return {
    currency: rate.currency.toUpperCase(),
    minor,
    fractionDigits: fd,
    value: formatDecimal(minor, fd, { minFractionDigits: fd }),
  };
}

/** Convert a fiat decimal string ("12.50") to msat, rounded half-up to the nearest msat. */
export function fiatToMsat(
  fiat: string,
  rate: FiatRate,
  rounding: Exclude<Rounding, 'reject'> = 'half-up',
): Msat {
  const fd = currencyFractionDigits(rate.currency);
  const minor = parseDecimal(fiat, fd, 'half-up');
  const p = toRational(rate.price);
  if (p.num <= 0n) throw new OrangeError('out-of-range', 'Exchange rate must be positive.');
  return divRound(minor * p.den * MSAT_PER_BTC, p.num * pow10(fd), rounding);
}
