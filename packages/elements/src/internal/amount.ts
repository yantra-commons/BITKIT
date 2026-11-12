import { MSAT_PER_SAT, type FiatRate } from '@orange-ui/core';
import { toBigint } from './converters.js';

/** Resolve msat from `msat` (preferred) or `amount` (sats) properties. */
export function resolveMsat(amountSats: unknown, msat: unknown): bigint | undefined {
  const m = toBigint(msat);
  if (m !== undefined) return m;
  const s = toBigint(amountSats);
  return s === undefined ? undefined : s * MSAT_PER_SAT;
}

/** Resolve a fiat rate from an object property or `fiat-currency` + `fiat-price` attributes. */
export function resolveFiatRate(
  rate: FiatRate | undefined,
  currency: string | undefined,
  price: string | undefined,
  fallback?: FiatRate,
): FiatRate | undefined {
  if (rate) return rate;
  if (currency && price) return { currency, price };
  return fallback;
}
