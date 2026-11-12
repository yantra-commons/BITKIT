import { OrangeError } from '../errors.js';

/**
 * Exact decimal helpers on bigint. A "scaled" bigint holds value × 10^scale.
 * Nothing here ever converts through a JS Number, so money math stays exact.
 */

export type Rounding = 'reject' | 'floor' | 'ceil' | 'half-up' | 'trunc';

const DECIMAL_RE = /^([+-])?(\d*)(?:\.(\d*))?$/;

export const pow10 = (n: number): bigint => 10n ** BigInt(n);

/**
 * Parse a plain decimal string ("12", "0.0025", ".5", "-3.10") into value × 10^scale.
 * Locale-specific separators must be normalised first (see `normalizeNumberInput`).
 */
export function parseDecimal(input: string, scale: number, rounding: Rounding = 'reject'): bigint {
  const s = input.trim();
  const m = DECIMAL_RE.exec(s);
  if (!s || !m || (!m[2] && !m[3])) {
    throw new OrangeError('invalid-number', `"${input}" is not a valid number.`);
  }
  const negative = m[1] === '-';
  const intDigits = m[2] || '0';
  const frac = m[3] ?? '';
  const kept = frac.slice(0, scale).padEnd(scale, '0');
  const excess = frac.slice(scale);
  let value = BigInt(intDigits) * pow10(scale) + BigInt(kept || '0');
  if (/[1-9]/.test(excess)) {
    switch (rounding) {
      case 'reject':
        throw new OrangeError('too-many-decimals', `Too many decimal places (maximum ${scale}).`);
      case 'ceil':
        if (!negative) value += 1n;
        break;
      case 'floor':
        if (negative) value += 1n;
        break;
      case 'half-up':
        if (excess.charCodeAt(0) >= 53 /* '5' */) value += 1n;
        break;
      case 'trunc':
        break;
    }
  }
  return negative ? -value : value;
}

export interface FormatDecimalOptions {
  /** Minimum digits after the point (zeros are kept up to here). Default 0. */
  minFractionDigits?: number;
  /** Maximum digits after the point; extra precision is rounded half-up. Default = scale. */
  maxFractionDigits?: number;
}

/** Format value × 10^-scale as a plain decimal string using '.' as separator. */
export function formatDecimal(
  value: bigint,
  scale: number,
  opts: FormatDecimalOptions = {},
): string {
  const maxFrac = Math.min(opts.maxFractionDigits ?? scale, scale);
  const minFrac = Math.min(opts.minFractionDigits ?? 0, maxFrac);
  const negative = value < 0n;
  let abs = negative ? -value : value;
  if (maxFrac < scale) abs = divRound(abs, pow10(scale - maxFrac), 'half-up');
  const unit = pow10(maxFrac);
  const int = abs / unit;
  let frac = maxFrac > 0 ? (abs % unit).toString().padStart(maxFrac, '0') : '';
  let end = frac.length;
  while (end > minFrac && frac[end - 1] === '0') end--;
  frac = frac.slice(0, end);
  const out = frac ? `${int}.${frac}` : `${int}`;
  return negative && abs !== 0n ? `-${out}` : out;
}

/** Integer division with explicit rounding. Works for negative numerators. */
export function divRound(
  n: bigint,
  d: bigint,
  rounding: Exclude<Rounding, 'reject'> = 'half-up',
): bigint {
  if (d === 0n) throw new OrangeError('out-of-range', 'Division by zero.');
  if (d < 0n) return divRound(-n, -d, rounding);
  const q = n / d; // truncates toward zero
  const r = n % d;
  if (r === 0n) return q;
  switch (rounding) {
    case 'trunc':
      return q;
    case 'floor':
      return n < 0n ? q - 1n : q;
    case 'ceil':
      return n > 0n ? q + 1n : q;
    case 'half-up': {
      const twice = (r < 0n ? -r : r) * 2n;
      if (twice >= d) return n < 0n ? q - 1n : q + 1n;
      return q;
    }
  }
}

/** An exact rational number num/den (den > 0). */
export interface Rational {
  num: bigint;
  den: bigint;
}

/** Parse a decimal string (or a finite number via its shortest string form) into a rational. */
export function toRational(value: string | number | bigint): Rational {
  if (typeof value === 'bigint') return { num: value, den: 1n };
  const s = typeof value === 'number' ? numberToPlainString(value) : value.trim();
  const frac = s.split('.')[1] ?? '';
  return { num: parseDecimal(s, frac.length), den: pow10(frac.length) };
}

/**
 * Shortest round-trip decimal form of a JS number without exponent notation. Used only to
 * accept rates that arrive as JSON numbers (e.g. `67012.5`), never for amounts.
 */
export function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new OrangeError('invalid-number', `${n} is not a finite number.`);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  const [mant = '0', expStr = '0'] = s.toLowerCase().split('e');
  const exp = Number.parseInt(expStr, 10);
  const negative = mant.startsWith('-');
  const [i = '0', f = ''] = mant.replace('-', '').split('.');
  const digits = i + f;
  const point = i.length + exp;
  let out: string;
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return negative ? `-${out}` : out;
}
