import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkAmountBounds,
  fromMsat,
  MAX_MSAT,
  msatToSats,
  satsToMsat,
  sumMsat,
  toMsat,
  toSats,
} from './amount.js';
import {
  divRound,
  formatDecimal,
  numberToPlainString,
  parseDecimal,
  toRational,
} from './decimal.js';
import { currencyFractionDigits, fiatToMsat, msatToFiat } from './fiat.js';
import {
  displayToInputUnit,
  formatAmount,
  formatBtc,
  formatFiat,
  formatFiatDecimal,
  formatSats,
  localizeDecimal,
  normalizeNumberInput,
} from './format.js';

describe('parseDecimal / formatDecimal', () => {
  it.each([
    ['1', 8, 100000000n],
    ['0.00000001', 8, 1n],
    ['.5', 2, 50n],
    ['12.', 2, 1200n],
    ['-3.10', 2, -310n],
    ['+7', 0, 7n],
    ['000123', 0, 123n],
  ])('parses %s @%i', (s, scale, expected) => {
    expect(parseDecimal(s, scale)).toBe(expected);
  });

  it.each(['', '.', 'abc', '1.2.3', '1e5', '--1', ' '])('rejects %j', (s) => {
    expect(() => parseDecimal(s, 2)).toThrow(/not a valid number/);
  });

  it('applies rounding modes to excess precision', () => {
    expect(() => parseDecimal('1.239', 2)).toThrow(/Too many decimal/);
    expect(parseDecimal('1.230', 2)).toBe(123n); // trailing zeros are not excess
    expect(parseDecimal('1.239', 2, 'trunc')).toBe(123n);
    expect(parseDecimal('1.231', 2, 'ceil')).toBe(124n);
    expect(parseDecimal('-1.231', 2, 'ceil')).toBe(-123n);
    expect(parseDecimal('1.239', 2, 'floor')).toBe(123n);
    expect(parseDecimal('-1.231', 2, 'floor')).toBe(-124n);
    expect(parseDecimal('1.235', 2, 'half-up')).toBe(124n);
    expect(parseDecimal('1.234', 2, 'half-up')).toBe(123n);
  });

  it('formats with min/max fraction digits', () => {
    expect(formatDecimal(12345n, 3)).toBe('12.345');
    expect(formatDecimal(12000n, 3)).toBe('12');
    expect(formatDecimal(12000n, 3, { minFractionDigits: 2 })).toBe('12.00');
    expect(formatDecimal(12345n, 3, { maxFractionDigits: 2 })).toBe('12.35');
    expect(formatDecimal(-5n, 3)).toBe('-0.005');
    expect(formatDecimal(-4n, 3, { maxFractionDigits: 2 })).toBe('0');
    expect(formatDecimal(0n, 0)).toBe('0');
  });

  it('round-trips arbitrary values (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }),
        fc.integer({ min: 0, max: 18 }),
        (v, scale) => {
          expect(parseDecimal(formatDecimal(v, scale), scale)).toBe(v);
        },
      ),
    );
  });

  it('divRound matches exact rational rounding (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 20n), max: 10n ** 20n }),
        fc.bigInt({ min: 1n, max: 10n ** 12n }),
        (n, d) => {
          const floor = divRound(n, d, 'floor');
          const ceil = divRound(n, d, 'ceil');
          expect(floor * d <= n).toBe(true);
          expect((floor + 1n) * d > n).toBe(true);
          expect(ceil - floor).toBe(n % d === 0n ? 0n : 1n);
          const half = divRound(n, d, 'half-up');
          expect(half === floor || half === ceil).toBe(true);
          expect(divRound(n, -d, 'trunc')).toBe(-(n / d));
        },
      ),
    );
    expect(() => divRound(1n, 0n)).toThrow();
    expect(divRound(-7n, 2n, 'half-up')).toBe(-4n);
    expect(divRound(-5n, 4n, 'half-up')).toBe(-1n);
  });

  it('converts numbers to plain strings without exponent', () => {
    expect(numberToPlainString(1e21)).toBe('1000000000000000000000');
    expect(numberToPlainString(1.5e-7)).toBe('0.00000015');
    expect(numberToPlainString(-2.5e-8)).toBe('-0.000000025');
    expect(numberToPlainString(1.23e21)).toBe('1230000000000000000000');
    expect(numberToPlainString(67012.55)).toBe('67012.55');
    expect(() => numberToPlainString(Number.NaN)).toThrow();
    expect(toRational(0.1)).toEqual({ num: 1n, den: 10n });
    expect(toRational(5n)).toEqual({ num: 5n, den: 1n });
  });
});

describe('amount conversions', () => {
  it('converts every unit to msat', () => {
    expect(toMsat('1', 'btc')).toBe(100_000_000_000n);
    expect(toMsat('0.00000001', 'btc')).toBe(1000n);
    expect(toMsat('1', 'mbtc')).toBe(100_000_000n);
    expect(toMsat('1', 'bits')).toBe(100_000n);
    expect(toMsat(21, 'sat')).toBe(21_000n);
    expect(toMsat(5n, 'sat')).toBe(5000n);
    expect(toMsat('1.234', 'sat')).toBe(1234n);
    expect(() => toMsat(0.1, 'btc')).toThrow(/strings/);
    expect(() => toMsat('0.000000000001', 'btc')).toThrow(/Too many decimal/);
  });

  it('avoids the classic 0.1 + 0.2 float bug', () => {
    expect(toMsat('0.1', 'btc') + toMsat('0.2', 'btc')).toBe(toMsat('0.3', 'btc'));
  });

  it('converts msat back to unit strings', () => {
    expect(fromMsat(12_345_000n, 'btc')).toBe('0.00012345');
    expect(fromMsat(100_000_000_000n, 'btc', { minFractionDigits: 2 })).toBe('1.00');
    expect(fromMsat(1500n, 'sat')).toBe('1.5');
    expect(msatToSats(1999n)).toBe(1n);
    expect(msatToSats(1500n, 'half-up')).toBe(2n);
    expect(satsToMsat(3n)).toBe(3000n);
  });

  it('coerces sats input', () => {
    expect(toSats('21000')).toBe(21000n);
    expect(toSats(42)).toBe(42n);
    expect(toSats(7n)).toBe(7n);
    expect(() => toSats('1.5')).toThrow();
    expect(() => toSats(1.5)).toThrow();
  });

  it('checks bounds', () => {
    expect(checkAmountBounds(5n, {})).toBeNull();
    expect(checkAmountBounds(-1n, {})).toEqual({ code: 'negative' });
    expect(checkAmountBounds(5n, { min: 10n })).toEqual({ code: 'out-of-range', bound: 'min' });
    expect(checkAmountBounds(50n, { max: 10n })).toEqual({ code: 'out-of-range', bound: 'max' });
    expect(checkAmountBounds(MAX_MSAT + 1n, {})).toEqual({ code: 'out-of-range', bound: 'max' });
    expect(sumMsat([1n, 2n, 3n])).toBe(6n);
  });

  it('sats ↔ BTC is lossless for all valid amounts (property)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 21_000_000n * 100_000_000n }), (sats) => {
        const msat = satsToMsat(sats);
        expect(toMsat(fromMsat(msat, 'btc'), 'btc')).toBe(msat);
      }),
    );
  });
});

describe('fiat', () => {
  const usd = { currency: 'USD', price: '60000' };

  it('knows currency minor units', () => {
    expect(currencyFractionDigits('usd')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('BHD')).toBe(3);
    expect(() => currencyFractionDigits('NOTACURRENCY')).toThrow(/Unknown currency/);
  });

  it('converts msat to fiat exactly', () => {
    expect(msatToFiat(100_000_000_000n, usd)).toMatchObject({
      value: '60000.00',
      minor: 6_000_000n,
    });
    expect(msatToFiat(satsToMsat(1000n), usd).value).toBe('0.60');
    expect(msatToFiat(satsToMsat(1n), usd).value).toBe('0.00');
    expect(msatToFiat(satsToMsat(10_000n), { currency: 'JPY', price: '9000000' }).value).toBe(
      '900',
    );
    expect(msatToFiat(satsToMsat(10_000n), { currency: 'USD', price: 67012.55 }).value).toBe(
      '6.70',
    );
  });

  it('converts fiat to msat', () => {
    expect(fiatToMsat('60000', usd)).toBe(100_000_000_000n);
    expect(fiatToMsat('6', usd)).toBe(satsToMsat(10_000n));
    expect(fiatToMsat('0.01', usd)).toBe(16_667n);
  });

  it('rejects non-positive rates', () => {
    expect(() => msatToFiat(1n, { currency: 'USD', price: '0' })).toThrow();
    expect(() => fiatToMsat('1', { currency: 'USD', price: '-1' })).toThrow();
  });

  it('fiat → msat → fiat is stable to the cent (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 9n }),
        fc.integer({ min: 1000, max: 500_000 }),
        (cents, price) => {
          const rate = { currency: 'USD', price: String(price) };
          const fiat = formatDecimal(cents, 2);
          expect(msatToFiat(fiatToMsat(fiat, rate), rate).minor).toBe(cents);
        },
      ),
    );
  });
});

describe('formatting', () => {
  it('formats sats with grouping and plural', () => {
    expect(formatSats(satsToMsat(12345n))).toBe('12,345 sats');
    expect(formatAmount(satsToMsat(1n)).text).toBe('1 sat');
    expect(formatAmount(satsToMsat(1n)).srText).toBe('1 sat');
    expect(formatAmount(1500n, { showMsat: true }).text).toBe('1.5 sats');
    expect(formatAmount(1999n).text).toBe('1 sat');
  });

  it('formats BTC by default trimmed to ≥2 decimals', () => {
    expect(formatBtc(satsToMsat(250_000n))).toBe('0.0025 BTC');
    expect(formatBtc(satsToMsat(100_000_000n))).toBe('1.00 BTC');
    expect(formatAmount(satsToMsat(250_000n), { unit: 'btc', btcDecimals: 'full' }).text).toBe(
      '0.00250000 BTC',
    );
    expect(formatAmount(satsToMsat(250_000n), { unit: 'btc', btcStyle: 'symbol' }).text).toBe(
      '₿0.0025',
    );
    expect(formatAmount(satsToMsat(-250_000n), { unit: 'btc', btcStyle: 'symbol' }).text).toBe(
      '-₿0.0025',
    );
    expect(formatAmount(satsToMsat(250_000n), { unit: 'btc' }).srText).toBe('0.0025 bitcoin');
  });

  it('auto unit switches at the threshold', () => {
    expect(formatAmount(satsToMsat(999_999n), { unit: 'auto' }).resolvedUnit).toBe('sats');
    expect(formatAmount(satsToMsat(1_000_000n), { unit: 'auto' }).resolvedUnit).toBe('btc');
    expect(formatAmount(satsToMsat(-5_000_000n), { unit: 'auto' }).resolvedUnit).toBe('btc');
    expect(
      formatAmount(satsToMsat(5000n), { unit: 'auto', autoThresholdSats: 1000n }).resolvedUnit,
    ).toBe('btc');
  });

  it('formats other units', () => {
    expect(formatAmount(satsToMsat(150_000n), { unit: 'mbtc' }).text).toBe('1.5 mBTC');
    expect(formatAmount(satsToMsat(100n), { unit: 'bits' }).text).toBe('1 bit');
    expect(formatAmount(satsToMsat(250n), { unit: 'bits' }).text).toBe('2.5 bits');
    expect(formatAmount(1n, { unit: 'msat' }).text).toBe('1 msat');
    expect(formatAmount(1n, { unit: 'msat' }).srText).toBe('1 millisat');
    expect(formatAmount(2000n, { unit: 'msat' }).text).toBe('2,000 msats');
  });

  it('respects signDisplay', () => {
    expect(formatAmount(satsToMsat(5n), { signDisplay: 'always' }).text).toBe('+5 sats');
    expect(formatAmount(satsToMsat(-5n), { signDisplay: 'never' }).text).toBe('5 sats');
    expect(formatAmount(satsToMsat(-5n)).text).toBe('-5 sats');
  });

  it('localises grouping (en-IN lakh, de-DE, fr-FR) without floats', () => {
    expect(formatAmount(satsToMsat(12_345_678n), { locale: 'en-IN' }).number).toBe('1,23,45,678');
    expect(formatAmount(satsToMsat(12_345_678n), { locale: 'de-DE' }).number).toBe('12.345.678');
    expect(formatAmount(satsToMsat(150_000n), { unit: 'btc', locale: 'de-DE' }).text).toBe(
      '0,0015 BTC',
    );
    expect(localizeDecimal('1234567.5', 'fr-FR').replace(/\s/g, ' ')).toBe('1 234 567,5');
    // Larger than Number.MAX_SAFE_INTEGER msat still formats exactly.
    expect(formatAmount(MAX_MSAT, { unit: 'msat' }).number).toBe('2,100,000,000,000,000,000');
  });

  it('formats fiat with currency symbol', () => {
    const rate = { currency: 'USD', price: '60000' };
    expect(formatFiat(satsToMsat(10_000n), rate)).toBe('$6.00');
    const eur = formatAmount(satsToMsat(10_000n), {
      unit: 'fiat',
      fiatRate: { currency: 'EUR', price: '60000' },
      locale: 'de-DE',
    });
    expect(eur.text.replace(/\s/g, ' ')).toBe('6,00 €');
    expect(eur.unitPosition).toBe('suffix');
    const us = formatAmount(satsToMsat(10_000n), { unit: 'fiat', fiatRate: rate });
    expect(us.unit).toBe('$');
    expect(us.unitPosition).toBe('prefix');
    expect(formatAmount(satsToMsat(-10_000n), { unit: 'fiat', fiatRate: rate }).text).toBe(
      '-$6.00',
    );
    expect(
      formatAmount(satsToMsat(10_000n), { unit: 'fiat', fiatRate: rate, signDisplay: 'always' })
        .text,
    ).toBe('+$6.00');
    expect(formatFiatDecimal('1234567.89', 'JPY', 'ja-JP')).toContain('1,234,567.89');
    expect(() => formatAmount(1n, { unit: 'fiat' })).toThrow(/fiat rate/);
  });

  it('normalises locale input', () => {
    expect(normalizeNumberInput('1,234.56')).toBe('1234.56');
    expect(normalizeNumberInput('1.234,56', 'de-DE')).toBe('1234.56');
    expect(normalizeNumberInput('0.001', 'de-DE')).toBe('0.001');
    expect(normalizeNumberInput('1.234.567', 'de-DE')).toBe('1234567');
    expect(normalizeNumberInput('1,23,456.7', 'en-IN')).toBe('123456.7');
    expect(normalizeNumberInput('1 234,5', 'fr-FR')).toBe('1234.5');
    expect(normalizeNumberInput('−5')).toBe('-5');
    expect(normalizeNumberInput("1'234.5", 'de-CH')).toBe('1234.5');
  });

  it('maps display units to input units', () => {
    expect(displayToInputUnit('sats')).toBe('sat');
    expect(displayToInputUnit('btc')).toBe('btc');
  });
});
