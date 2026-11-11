import { describe, expect, it } from 'vitest';
import { isSafeId, MAX_SATS, rateLimiter, toJson, validateCreate } from './handlers.mjs';

describe('payment proxy handlers', () => {
  it('accepts valid requests and trims fields', () => {
    const r = validateCreate({
      amountSats: '21000',
      description: 'x'.repeat(500),
      methods: ['lightning', 'evil'],
    });
    expect(r.ok).toBe(true);
    expect(r.value.amountSats).toBe(21000n);
    expect(r.value.description).toHaveLength(140);
    expect(r.value.methods).toEqual(['lightning']);
  });

  it.each([
    null,
    {},
    { amountSats: '1.5' },
    { amountSats: '-1' },
    { amountSats: '0' },
    { amountSats: String(MAX_SATS + 1n) },
    { amountSats: '1e9' },
  ])('rejects %j', (body) => {
    expect(validateCreate(body).ok).toBe(false);
  });

  it('restricts ids, serialises bigint and rate limits', () => {
    expect(isSafeId('abc_DEF-123')).toBe(true);
    expect(isSafeId('../etc/passwd')).toBe(false);
    expect(toJson({ a: 1n })).toBe('{"a":"1"}');
    let t = 0;
    const allow = rateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect([allow('ip'), allow('ip'), allow('ip')]).toEqual([true, true, false]);
    t = 1000;
    expect(allow('ip')).toBe(true);
  });
});
