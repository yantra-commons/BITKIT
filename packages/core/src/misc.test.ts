import { describe, expect, it } from 'vitest';
import { BitkitError, isBitkitError, toErrorInfo } from './errors.js';
import {
  checkFeeRate,
  estimateVsize,
  feeForVsize,
  feeTiersFromRecommended,
  formatEta,
  normalizeFeeRate,
} from './fees/fees.js';
import {
  backupCheckChoices,
  checkMnemonic,
  completeWord,
  isBip39Word,
  pickBackupCheckIndices,
  splitMnemonic,
  suggestWords,
  wordlist,
} from './mnemonic/index.js';
import { countdownForScreenReader, formatCountdown, formatRelativeTime } from './time.js';
import { wordsToInt } from './encoding.js';
import { looksLikeNwcUri, parseNwcUri } from './lightning/nwc.js';

describe('fees', () => {
  const rec = { fastestFee: 25, halfHourFee: 12, hourFee: 8, economyFee: 4, minimumFee: 1 };

  it('builds tiers from recommended fees', () => {
    expect(feeTiersFromRecommended(rec)).toEqual([
      { tier: 'fast', satPerVb: '25', etaMinutes: 10, label: 'Fast' },
      { tier: 'normal', satPerVb: '12', etaMinutes: 30, label: 'Normal' },
      { tier: 'slow', satPerVb: '4', etaMinutes: 120, label: 'Slow' },
    ]);
    expect(
      feeTiersFromRecommended({ fastestFee: 3.5, halfHourFee: 2.012, hourFee: 1 })[2],
    ).toMatchObject({ satPerVb: '1', etaMinutes: 60 });
    expect(normalizeFeeRate(2.0123)).toBe('2.013');
    expect(() => normalizeFeeRate(0)).toThrow();
  });

  it('estimates vsize for common shapes', () => {
    // 1-in 2-out P2WPKH ≈ 141 vB
    expect(estimateVsize({ p2wpkh: 1 }, { p2wpkh: 2 })).toBe(141);
    // 1-in 1-out P2TR key-path ≈ 111 vB
    expect(estimateVsize(['p2tr'], ['p2tr'])).toBe(111);
    // legacy 1-in 2-out ≈ 226 vB
    expect(estimateVsize({ p2pkh: 1 }, { p2pkh: 2 })).toBe(226);
    expect(
      estimateVsize({ 'p2sh-p2wpkh': 2, p2wsh: 1, p2sh: 1 }, ['p2sh', 'p2wsh', 'p2sh-p2wpkh']),
    ).toBeGreaterThan(500);
    expect(estimateVsize({ p2wpkh: 300 }, { p2wpkh: 1 })).toBeGreaterThan(300 * 68);
  });

  it('computes fees exactly, rounding up', () => {
    expect(feeForVsize(141, 12)).toBe(1692n);
    expect(feeForVsize(141, '1.5')).toBe(212n);
    expect(feeForVsize(141, 1.001)).toBe(142n);
    expect(() => feeForVsize(-1, 1)).toThrow();
  });

  it('sanity-checks custom rates', () => {
    expect(checkFeeRate('10', rec)).toEqual({ ok: true });
    expect(checkFeeRate('0.5', rec)).toMatchObject({ ok: false, warning: 'too-low' });
    expect(checkFeeRate('100', rec)).toMatchObject({ ok: true, warning: 'high' });
    expect(checkFeeRate('abc')).toMatchObject({ ok: false });
    expect(checkFeeRate('2')).toEqual({ ok: true });
  });

  it('formats ETA', () => {
    expect(formatEta(10)).toBe('~10 min');
    expect(formatEta(60)).toBe('~1 hour');
    expect(formatEta(120)).toBe('~2 hours');
    expect(formatEta(1440)).toBe('~1 day');
    expect(formatEta(4320)).toBe('~3 days');
  });
});

describe('mnemonic helpers', () => {
  it('validates BIP39 test vectors', () => {
    expect(wordlist).toHaveLength(2048);
    const v1 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(checkMnemonic(splitMnemonic(v1))).toMatchObject({ valid: true, checksumValid: true });
    const v2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    expect(checkMnemonic(splitMnemonic(v2)).valid).toBe(true);
    const zoo =
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote';
    expect(checkMnemonic(splitMnemonic(zoo)).valid).toBe(true);
  });

  it('explains invalid phrases', () => {
    const bad = checkMnemonic(splitMnemonic('abandon '.repeat(12)));
    expect(bad).toMatchObject({ valid: false, wordCountValid: true, checksumValid: false });
    expect(bad.message).toMatch(/order and spelling/);
    const words = checkMnemonic(['abandon', 'bitcoinz', 'about', 'xyz']);
    expect(words.invalidWordIndices).toEqual([1, 3]);
    expect(words.message).toBe('Word 2, 4 are not in the word list.');
    expect(checkMnemonic(['notaword']).message).toBe('Word 1 is not in the word list.');
    expect(checkMnemonic(['abandon', 'about']).message).toMatch(/12, 15, 18, 21 or 24/);
  });

  it('suggests and completes words', () => {
    expect(suggestWords('aba')).toEqual(['abandon']);
    expect(suggestWords('ab', 3)).toEqual(['abandon', 'ability', 'able']);
    expect(suggestWords('')).toEqual([]);
    expect(completeWord('aban')).toBe('abandon');
    expect(completeWord('ab')).toBeNull();
    expect(completeWord('act')).toBe('act'); // exact word that is also a prefix of others
    expect(isBip39Word(' Zoo ')).toBe(true);
    expect(isBip39Word('satoshi')).toBe(true); // yes, really
    expect(isBip39Word('qwerty')).toBe(false);
    expect(splitMnemonic(' Abandon,  ABOUT\n')).toEqual(['abandon', 'about']);
  });

  it('picks backup check indices and choices', () => {
    const idx = pickBackupCheckIndices(12, 3);
    expect(idx).toHaveLength(3);
    expect(new Set(idx).size).toBe(3);
    expect(idx.every((i) => i >= 0 && i < 12)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(() => pickBackupCheckIndices(2, 3)).toThrow();
    let n = 0;
    const det = (max: number) => n++ % max;
    expect(pickBackupCheckIndices(12, 2, det)).toEqual([0, 1]);
    const choices = backupCheckChoices('zoo', 4);
    expect(choices).toHaveLength(4);
    expect(choices).toContain('zoo');
  });
});

describe('time', () => {
  it('formats countdowns', () => {
    expect(formatCountdown(245)).toBe('4:05');
    expect(formatCountdown(3723)).toBe('1:02:03');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(countdownForScreenReader(61)).toBe('1 minute 1 second');
    expect(countdownForScreenReader(7200)).toBe('2 hours');
    expect(countdownForScreenReader(0)).toBe('0 seconds');
  });

  it('formats relative time', () => {
    const now = Date.UTC(2026, 0, 1);
    expect(formatRelativeTime(now - 3 * 60_000, now)).toBe('3 minutes ago');
    expect(formatRelativeTime(now + 2 * 3600_000, now)).toBe('in 2 hours');
    expect(formatRelativeTime(now - 86400_000, now)).toBe('yesterday');
    expect(formatRelativeTime(now - 400 * 86400_000, now)).toBe('last year');
    expect(formatRelativeTime(new Date(now - 10_000), new Date(now))).toBe('10 seconds ago');
  });
});

describe('errors and encoding', () => {
  it('wraps errors', () => {
    const e = new BitkitError('empty', 'x');
    expect(isBitkitError(e)).toBe(true);
    expect(toErrorInfo(e)).toEqual({ code: 'empty', message: 'x' });
    expect(toErrorInfo(new Error('boom'))).toEqual({ code: 'unrecognized', message: 'boom' });
    expect(toErrorInfo('str')).toEqual({ code: 'unrecognized', message: 'str' });
  });

  it('converts words to ints', () => {
    expect(wordsToInt([1, 28])).toBe(60);
  });
});

describe('parseNwcUri', () => {
  const pk = 'b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4';
  const secret = '71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c';
  it('parses a valid connection string', () => {
    const c = parseNwcUri(
      `nostr+walletconnect://${pk}?relay=wss%3A%2F%2Frelay.damus.io&relay=wss://nos.lol&secret=${secret}&lud16=me@example.com`,
    );
    expect(c).toEqual({
      walletPubkey: pk,
      relays: ['wss://relay.damus.io', 'wss://nos.lol'],
      secret,
      lud16: 'me@example.com',
    });
    expect(looksLikeNwcUri(' NOSTR+WALLETCONNECT://x')).toBe(true);
  });
  it.each([
    ['nostr:xyz', /not a Nostr Wallet Connect/],
    [`nostr+walletconnect://abc?relay=wss://r&secret=${secret}`, /wallet key/],
    [`nostr+walletconnect://${pk}?secret=${secret}`, /no relay/],
    [`nostr+walletconnect://${pk}?relay=wss://r&secret=short`, /secret/],
    [`nostr+walletconnect://${pk}`, /no relay/],
  ])('rejects %s', (uri, msg) => {
    expect(() => parseNwcUri(uri)).toThrow(msg);
  });
});
