import { BitkitError } from '../errors.js';
import { divRound, formatDecimal, parseDecimal, toRational } from '../units/decimal.js';

export type FeeTier = 'fast' | 'normal' | 'slow' | 'custom';

/** Shape returned by mempool.space `/api/v1/fees/recommended` (sat/vB). */
export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee?: number;
  minimumFee?: number;
}

export interface FeeTierOption {
  tier: FeeTier;
  /** Fee rate as an exact decimal string in sat/vB (e.g. "12" or "1.5"). */
  satPerVb: string;
  /** Rough confirmation estimate in minutes. */
  etaMinutes: number;
  label: string;
}

export const FEE_TIER_LABELS: Readonly<Record<FeeTier, string>> = {
  fast: 'Fast',
  normal: 'Normal',
  slow: 'Slow',
  custom: 'Custom',
};

/** Fee rate precision: milli-sat per vbyte. */
const RATE_DECIMALS = 3;

/** Normalise a sat/vB fee rate (number or string) to an exact decimal string. */
export function normalizeFeeRate(rate: number | string): string {
  const r = toRational(rate);
  if (r.num <= 0n) throw new BitkitError('out-of-range', 'Fee rate must be greater than zero.');
  return formatDecimal(divRound(r.num * 1000n, r.den, 'ceil'), RATE_DECIMALS);
}

/** Build fast/normal/slow tiers from recommended fees. */
export function feeTiersFromRecommended(fees: RecommendedFees): FeeTierOption[] {
  return [
    {
      tier: 'fast',
      satPerVb: normalizeFeeRate(fees.fastestFee),
      etaMinutes: 10,
      label: FEE_TIER_LABELS.fast,
    },
    {
      tier: 'normal',
      satPerVb: normalizeFeeRate(fees.halfHourFee),
      etaMinutes: 30,
      label: FEE_TIER_LABELS.normal,
    },
    {
      tier: 'slow',
      satPerVb: normalizeFeeRate(fees.economyFee ?? fees.hourFee),
      etaMinutes: fees.economyFee ? 120 : 60,
      label: FEE_TIER_LABELS.slow,
    },
  ];
}

export type ScriptType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'p2sh';

/** Approximate input weight (WU) including witness, for single-sig spends. */
const INPUT_WEIGHT: Record<ScriptType, number> = {
  p2pkh: 592, // 148 vB
  'p2sh-p2wpkh': 364, // 91 vB
  p2wpkh: 272, // 68 vB
  p2wsh: 416, // 2-of-3 multisig ≈ 104 vB
  p2tr: 230, // 57.5 vB key-path
  p2sh: 1188, // 2-of-3 legacy multisig ≈ 297 vB
};

/** Output weight (WU) = 4 × serialized size. */
const OUTPUT_WEIGHT: Record<ScriptType, number> = {
  p2pkh: 136,
  'p2sh-p2wpkh': 128,
  p2sh: 128,
  p2wpkh: 124,
  p2wsh: 172,
  p2tr: 172,
};

export type ScriptCounts = Partial<Record<ScriptType, number>> | ScriptType[];

const toCounts = (c: ScriptCounts): [ScriptType, number][] =>
  Array.isArray(c)
    ? (Object.entries(
        c.reduce<Record<string, number>>((a, t) => ({ ...a, [t]: (a[t] ?? 0) + 1 }), {}),
      ) as [ScriptType, number][])
    : (Object.entries(c) as [ScriptType, number][]);

/** Estimate transaction virtual size (vbytes, rounded up) for given inputs/outputs. */
export function estimateVsize(inputs: ScriptCounts, outputs: ScriptCounts): number {
  const ins = toCounts(inputs);
  const outs = toCounts(outputs);
  const nIn = ins.reduce((a, [, n]) => a + n, 0);
  const nOut = outs.reduce((a, [, n]) => a + n, 0);
  const segwit = ins.some(([t, n]) => n > 0 && t !== 'p2pkh' && t !== 'p2sh');
  const varint = (n: number) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5);
  let weight = (4 + 4 + varint(nIn) + varint(nOut)) * 4; // version + locktime + counts
  if (segwit) weight += 2; // marker + flag
  for (const [t, n] of ins) weight += INPUT_WEIGHT[t] * n;
  for (const [t, n] of outs) weight += OUTPUT_WEIGHT[t] * n;
  return Math.ceil(weight / 4);
}

/** Fee in sats for a vsize at a fee rate (sat/vB, exact decimal), rounded up. */
export function feeForVsize(vsize: number, satPerVb: number | string): bigint {
  if (!Number.isInteger(vsize) || vsize < 0) throw new BitkitError('out-of-range', 'Invalid size.');
  const milli = parseDecimal(normalizeFeeRate(satPerVb), RATE_DECIMALS);
  return divRound(BigInt(vsize) * milli, 1000n, 'ceil');
}

export interface FeeRateCheck {
  ok: boolean;
  /** 'too-low' below min relay / economy, 'high' above 2× fastest (overpay warning). */
  warning?: 'too-low' | 'high';
  message?: string;
}

/** Sanity-check a custom fee rate against recommended fees. */
export function checkFeeRate(satPerVb: string | number, fees?: RecommendedFees): FeeRateCheck {
  let rate: bigint;
  try {
    rate = parseDecimal(normalizeFeeRate(satPerVb), RATE_DECIMALS);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const min = parseDecimal(normalizeFeeRate(fees?.minimumFee ?? 1), RATE_DECIMALS);
  if (rate < min)
    return {
      ok: false,
      warning: 'too-low',
      message: 'This fee is too low and the transaction may never confirm.',
    };
  if (fees && rate > parseDecimal(normalizeFeeRate(fees.fastestFee), RATE_DECIMALS) * 2n) {
    return {
      ok: true,
      warning: 'high',
      message: 'This fee is much higher than needed for fast confirmation.',
    };
  }
  return { ok: true };
}

/** "~10 min", "~1 hour", "~2 hours", "~1 day". */
export function formatEta(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `~${days} ${days === 1 ? 'day' : 'days'}`;
}
