import { BitkitError } from '../errors.js';
import { fromMsat, MSAT_PER_SAT, type BitcoinUnit, type Msat } from './amount.js';
import { formatDecimal } from './decimal.js';
import { msatToFiat, type FiatRate } from './fiat.js';

/** How an amount is shown. `auto` picks sats below `autoThresholdSats`, BTC above. */
export type DisplayUnit = 'sats' | 'btc' | 'mbtc' | 'bits' | 'msat' | 'fiat' | 'auto';

export interface FormatAmountOptions {
  unit?: DisplayUnit;
  /** BCP 47 locale. Default: 'en-US'. */
  locale?: string;
  /** Required when unit is 'fiat'. */
  fiatRate?: FiatRate;
  /** BTC label: 'code' → "0.5 BTC", 'symbol' → "₿0.5". Default 'code'. */
  btcStyle?: 'code' | 'symbol';
  /**
   * BTC decimals: 'trim' drops trailing zeros (keeping `minBtcDecimals`), 'full' always shows 8.
   * Default 'trim'.
   */
  btcDecimals?: 'trim' | 'full';
  /** Minimum decimals when btcDecimals is 'trim'. Default 2. */
  minBtcDecimals?: number;
  /** Threshold for 'auto' unit, in sats. Default 1,000,000 (0.01 BTC). */
  autoThresholdSats?: bigint;
  /** Show sub-sat precision for sats ("1,234.567 sats"). Default false (rounds down). */
  showMsat?: boolean;
  /** Prefix positive values with "+". Default false. */
  signDisplay?: 'auto' | 'always' | 'never';
}

export interface FormattedAmount {
  /** Full display text, e.g. "12,345 sats". */
  text: string;
  /** Localised number portion, e.g. "12,345". */
  number: string;
  /** Unit label, e.g. "sats", "BTC", "₿", "$". */
  unit: string;
  /** Whether the unit precedes the number. */
  unitPosition: 'prefix' | 'suffix';
  /** Unit actually used (resolves 'auto'). */
  resolvedUnit: Exclude<DisplayUnit, 'auto'>;
  /** Text suited to screen readers, e.g. "0.0025 bitcoin", "1 sat". */
  srText: string;
}

interface LocaleSymbols {
  decimal: string;
  group: string;
  minus: string;
}

const symbolCache = new Map<string, LocaleSymbols>();

/** Decimal/group/minus symbols for a locale (latin digits). */
export function localeSymbols(locale = 'en-US'): LocaleSymbols {
  let s = symbolCache.get(locale);
  if (!s) {
    const parts = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(
      -12345.6,
    );
    const find = (t: string, d: string) => parts.find((p) => p.type === t)?.value ?? d;
    s = { decimal: find('decimal', '.'), group: find('group', ','), minus: find('minusSign', '-') };
    symbolCache.set(locale, s);
  }
  return s;
}

/**
 * Localise a plain decimal string ("-1234567.891") with the locale's grouping (including
 * Indian lakh/crore grouping for en-IN) without ever converting it to a JS Number.
 */
export function localizeDecimal(plain: string, locale = 'en-US'): string {
  const negative = plain.startsWith('-');
  const [int = '0', frac] = plain.replace(/^[-+]/, '').split('.');
  const sym = localeSymbols(locale);
  const intText = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(BigInt(int));
  const body = frac ? `${intText}${sym.decimal}${frac}` : intText;
  if (negative) return `${sym.minus}${body}`;
  return plain.startsWith('+') ? `+${body}` : body;
}

/**
 * Turn locale-formatted user input ("1.234,56" in de-DE, "1,23,456.7" in en-IN) into a plain
 * decimal string. Accepts both '.' and the locale decimal symbol as the decimal separator.
 */
export function normalizeNumberInput(input: string, locale = 'en-US'): string {
  const { decimal, group } = localeSymbols(locale);
  let s = input
    .trim()
    .replace(/[\s  _'’]/g, '')
    .replace(/^−/, '-');
  const groups = group.trim() && group !== "'" && group !== '’' ? [group] : [];
  if (decimal !== '.' && s.includes(decimal)) {
    for (const g of groups) s = s.split(g).join('');
    return s.replace(decimal, '.');
  }
  // No locale decimal symbol present: a single '.' is treated as the decimal point.
  for (const g of groups) if (g !== '.' || countOf(s, '.') > 1) s = s.split(g).join('');
  return s;
}

const countOf = (s: string, ch: string) => s.split(ch).length - 1;

const plural = (n: string, one: string, many: string) => (/^-?1$/.test(n) ? one : many);

/** Format an msat amount for display. Never uses floating point. */
export function formatAmount(msat: Msat, opts: FormatAmountOptions = {}): FormattedAmount {
  const locale = opts.locale ?? 'en-US';
  let unit = opts.unit ?? 'sats';
  if (unit === 'auto') {
    const threshold = (opts.autoThresholdSats ?? 1_000_000n) * MSAT_PER_SAT;
    const abs = msat < 0n ? -msat : msat;
    unit = abs >= threshold ? 'btc' : 'sats';
  }
  const sign = (n: string) => {
    if (opts.signDisplay === 'never') return n.replace(/^-/, '');
    if (opts.signDisplay === 'always' && msat > 0n) return `+${n}`;
    return n;
  };

  if (unit === 'fiat') {
    if (!opts.fiatRate)
      throw new BitkitError('invalid-number', 'A fiat rate is required to show fiat values.');
    const fiat = msatToFiat(msat, opts.fiatRate);
    const text = formatFiatDecimal(sign(fiat.value), fiat.currency, locale);
    const symbolPart = text.replace(/[\d\s.,  '’+\-−]/g, '') || fiat.currency;
    const symbolIndex = text.indexOf(symbolPart);
    return {
      text,
      number: localizeDecimal(sign(fiat.value), locale),
      unit: symbolPart,
      unitPosition: symbolIndex >= 0 && symbolIndex < text.search(/\d/) ? 'prefix' : 'suffix',
      resolvedUnit: 'fiat',
      srText: text,
    };
  }

  let plain: string;
  let label: string;
  let srUnit: string;
  let position: 'prefix' | 'suffix' = 'suffix';
  switch (unit) {
    case 'btc': {
      const full = opts.btcDecimals === 'full';
      plain = fromMsat(msat, 'btc', {
        maxFractionDigits: 8,
        minFractionDigits: full ? 8 : (opts.minBtcDecimals ?? 2),
      });
      if (opts.btcStyle === 'symbol') {
        label = '₿';
        position = 'prefix';
      } else label = 'BTC';
      srUnit = 'bitcoin';
      break;
    }
    case 'mbtc':
      plain = fromMsat(msat, 'mbtc', { maxFractionDigits: 5 });
      label = 'mBTC';
      srUnit = 'millibitcoin';
      break;
    case 'bits':
      plain = fromMsat(msat, 'bits', { maxFractionDigits: 2 });
      label = plural(plain, 'bit', 'bits');
      srUnit = label;
      break;
    case 'msat':
      plain = fromMsat(msat, 'msat');
      label = plural(plain, 'msat', 'msats');
      srUnit = plural(plain, 'millisat', 'millisats');
      break;
    default: {
      plain = opts.showMsat ? fromMsat(msat, 'sat') : formatDecimal(msat / MSAT_PER_SAT, 0); // bigint division truncates toward zero
      label = plural(plain, 'sat', 'sats');
      srUnit = label;
      unit = 'sats';
    }
  }
  const number = localizeDecimal(sign(plain), locale);
  const text = position === 'prefix' ? signedPrefix(number, label) : `${number} ${label}`;
  return {
    text,
    number,
    unit: label,
    unitPosition: position,
    resolvedUnit: unit as Exclude<DisplayUnit, 'auto'>,
    srText: `${number} ${srUnit}`,
  };
}

const signedPrefix = (number: string, symbol: string) =>
  /^[+\-−]/.test(number) ? `${number[0]}${symbol}${number.slice(1)}` : `${symbol}${number}`;

/** Format a plain decimal fiat value with currency symbol, bigint-safe. */
export function formatFiatDecimal(plain: string, currency: string, locale = 'en-US'): string {
  const negative = plain.startsWith('-');
  const positive = plain.startsWith('+');
  const [int = '0', frac = ''] = plain.replace(/^[-+]/, '').split('.');
  const nf = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const parts = nf.formatToParts(BigInt(int));
  const decimal = localeSymbols(locale).decimal;
  let lastInt = -1;
  parts.forEach((p, i) => {
    if (p.type === 'integer') lastInt = i;
  });
  const out = parts
    .map((p, i) => (i === lastInt && frac ? `${p.value}${decimal}${frac}` : p.value))
    .join('');
  if (negative) return `${localeSymbols(locale).minus}${out}`;
  if (positive) return `+${out}`;
  return out;
}

/** Convenience: format a fiat equivalent, e.g. "≈ $12.34". */
export function formatFiat(msat: Msat, rate: FiatRate, locale = 'en-US'): string {
  return formatAmount(msat, { unit: 'fiat', fiatRate: rate, locale }).text;
}

/** Shortcut formatters. */
export const formatSats = (msat: Msat, locale?: string) =>
  formatAmount(msat, { unit: 'sats', locale }).text;
export const formatBtc = (msat: Msat, locale?: string) =>
  formatAmount(msat, { unit: 'btc', locale }).text;

/** Map a display unit to the input unit it edits in. */
export const displayToInputUnit = (u: Exclude<DisplayUnit, 'auto' | 'fiat'>): BitcoinUnit =>
  u === 'sats' ? 'sat' : u;
