import { describe, expect, it } from 'vitest';
import vectors from '../../test/fixtures/bolt11-invoice-test.json' with { type: 'json' };
import { bech32 } from '@scure/base';
import { decodeBolt11, isInvoiceExpired, looksLikeBolt11, secondsUntilExpiry } from './bolt11.js';
import { bolt12Kind, decodeBolt12Offer, looksLikeBolt12Offer } from './bolt12.js';
import { decodeLnurl, encodeLnurl, looksLikeLnurl } from './lnurl.js';
import { looksLikeLightningAddress, parseLightningAddress } from './lightning-address.js';
import { BECH32_CHARSET } from '../encoding.js';

const V = vectors as { description: string; valid: boolean; invoice: string }[];
/** Invalid only because of signature checks, which this display-level decoder skips. */
const SIGNATURE_ONLY = new Set([25, 30]);

describe('BOLT11 spec vectors', () => {
  V.forEach((v, i) => {
    if (v.valid) {
      it(`#${i} decodes: ${v.description.slice(0, 60)}`, () => {
        const inv = decodeBolt11(v.invoice);
        expect(inv.timestamp).toBeGreaterThanOrEqual(1496314658);
        expect(inv.paymentSecret).toBe('11'.repeat(32));
        expect(inv.paymentHash).toMatch(/^[0-9a-f]{64}$/);
        expect(inv.signature).toMatch(/^[0-9a-f]{128}$/);
        const fallback = /fallback(?: \(\w+\))? address (\w+)/.exec(v.description)?.[1];
        if (fallback)
          expect(inv.fallbackAddresses).toContain(
            fallback.startsWith('bc1') ? fallback.toLowerCase() : fallback,
          );
      });
    } else if (SIGNATURE_ONLY.has(i)) {
      it.skip(`#${i} requires signature verification: ${v.description}`, () => {});
    } else {
      it(`#${i} rejects: ${v.description}`, () => {
        expect(() => decodeBolt11(v.invoice)).toThrow();
      });
    }
  });

  it('decodes the donation invoice (#0) fields', () => {
    const inv = decodeBolt11(V[0]!.invoice);
    expect(inv).toMatchObject({
      network: 'mainnet',
      amountMsat: null,
      description: 'Please consider supporting this project',
      paymentHash: '0001020304050607080900010203040506070809000102030405060708090102',
      expiry: 3600,
      expiresAt: 1496314658 + 3600,
      minFinalCltvExpiry: 18,
      features: [8, 14],
      recoveryFlag: 1,
    });
    expect(
      inv.signature.startsWith('8d3ce9e28357337f62da0162d9454df827f83cfe499aeb1c1db349d4d811274'),
    ).toBe(true);
  });

  it('decodes amounts and multipliers', () => {
    expect(decodeBolt11(V[1]!.invoice)).toMatchObject({
      amountMsat: 250_000_000n,
      expiry: 60,
      description: '1 cup coffee',
    });
    expect(decodeBolt11(V[2]!.invoice).description).toBe('ナンセンス 1杯');
    expect(decodeBolt11(V[3]!.invoice)).toMatchObject({
      amountMsat: 2_000_000_000n,
      descriptionHash: '3925b6f67e2c340036ed12093dd44e0368df1b6ea26c53dbe4811f58fd5db8c1',
    });
    expect(decodeBolt11(V[10]!.invoice).amountMsat).toBe(967_878_534n);
  });

  it('decodes network, route hints, features, metadata and upper case', () => {
    expect(decodeBolt11(V[4]!.invoice).network).toBe('testnet');
    const hints = decodeBolt11(V[5]!.invoice).routeHints;
    expect(hints[0]!.map((h) => h.pubkey.slice(0, 4))).toEqual(['029e', '039e']);
    expect(hints[0]![0]).toMatchObject({
      shortChannelId: '66051x263430x1800',
      feeBaseMsat: 1,
      feeProportionalMillionths: 20,
      cltvExpiryDelta: 3,
    });
    expect(decodeBolt11(V[11]!.invoice).features).toEqual([8, 14, 99]);
    expect(decodeBolt11(V[12]!.invoice).paymentRequest).toBe(V[11]!.invoice);
    expect(decodeBolt11(V[14]!.invoice).metadata).toBe('01fafaf0');
    expect(decodeBolt11(`lightning:${V[1]!.invoice}`).amountMsat).toBe(250_000_000n);
  });

  it('gives specific error codes', () => {
    const code = (s: string) => {
      try {
        decodeBolt11(s);
        return null;
      } catch (e) {
        return (e as { code: string }).code;
      }
    };
    expect(code(V[16]!.invoice)).toBe('unknown-required-feature');
    expect(code(V[17]!.invoice)).toBe('invalid-field');
    expect(code(V[18]!.invoice)).toBe('missing-field');
    expect(code(V[19]!.invoice)).toBe('duplicate-field');
    expect(code(V[22]!.invoice)).toBe('invalid-checksum');
    expect(code(V[24]!.invoice)).toBe('mixed-case');
    expect(code(V[27]!.invoice)).toBe('invalid-amount');
    expect(code(V[28]!.invoice)).toBe('invalid-amount');
    expect(code('')).toBe('empty');
    expect(code('lnxy1abc')).toBe('unknown-prefix');
    expect(code('lnbc')).toBe('invalid-characters');
  });

  it('computes expiry', () => {
    const inv = decodeBolt11(V[1]!.invoice);
    expect(secondsUntilExpiry(inv, (1496314658 + 30) * 1000)).toBe(30);
    expect(isInvoiceExpired(inv, (1496314658 + 30) * 1000)).toBe(false);
    expect(isInvoiceExpired(inv)).toBe(true);
    expect(looksLikeBolt11(V[1]!.invoice)).toBe(true);
    expect(looksLikeBolt11('LIGHTNING:' + V[1]!.invoice.toUpperCase())).toBe(true);
    expect(looksLikeBolt11('bc1qxyz')).toBe(false);
  });
});

describe('LNURL', () => {
  const url =
    'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df';
  // LUD-01 example.
  const lud01 =
    'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';

  it('decodes bech32 LNURL (LUD-01 example)', () => {
    const l = decodeLnurl(lud01);
    expect(l.url).toBe(url);
    expect(l.kind).toBe('unknown');
    expect(decodeLnurl(`lightning:${lud01.toLowerCase()}`).url).toBe(url);
  });

  it('round-trips encode/decode and detects tags', () => {
    expect(encodeLnurl(url)).toBe(lud01);
    expect(decodeLnurl(encodeLnurl('https://x.com/w?tag=withdrawRequest&k1=1')).kind).toBe(
      'withdraw',
    );
    expect(decodeLnurl(encodeLnurl('https://x.com/?tag=login&k1=1')).kind).toBe('auth');
  });

  it('decodes LUD-17 schemes', () => {
    expect(decodeLnurl('lnurlp://pay.example.com/abc')).toMatchObject({
      url: 'https://pay.example.com/abc',
      kind: 'pay',
    });
    expect(decodeLnurl('lnurlw://x.onion/w')).toMatchObject({
      url: 'http://x.onion/w',
      kind: 'withdraw',
    });
    expect(decodeLnurl('keyauth://x.com/a').kind).toBe('auth');
    expect(decodeLnurl('lnurlc://x.com/c').kind).toBe('channel');
  });

  it('rejects bad input', () => {
    expect(() => decodeLnurl('lnurl1qqqq')).toThrow(/typo/);
    expect(() => decodeLnurl('LNURL1dp68')).toThrow(/invalid/);
    expect(() => decodeLnurl(encodeLnurl('http://plain.com/x'))).toThrow(/https/);
    expect(() => decodeLnurl(encodeLnurl('not a url'))).toThrow(/valid link/);
    expect(() =>
      decodeLnurl(
        bech32.encode('lnurx', bech32.toWords(new TextEncoder().encode('https://a.b')), false),
      ),
    ).toThrow();
    expect(looksLikeLnurl(lud01)).toBe(true);
    expect(looksLikeLnurl('lnurlp://a.b/c')).toBe(true);
    expect(looksLikeLnurl('lnbc1')).toBe(false);
  });
});

describe('Lightning Address', () => {
  it('parses and builds the LNURL-pay endpoint', () => {
    expect(parseLightningAddress('Satoshi@Example.com')).toEqual({
      address: 'satoshi@example.com',
      username: 'satoshi',
      domain: 'example.com',
      lnurlpUrl: 'https://example.com/.well-known/lnurlp/satoshi',
    });
    expect(parseLightningAddress('₿tips@abc.onion').lnurlpUrl).toBe(
      'http://abc.onion/.well-known/lnurlp/tips',
    );
    expect(parseLightningAddress('lightning:a+b@pay.example.co.uk:8443').domain).toBe(
      'pay.example.co.uk:8443',
    );
  });

  it('rejects invalid addresses', () => {
    for (const bad of ['satoshi', '@example.com', 'a@b', 'a b@c.com', 'a@-x.com']) {
      expect(looksLikeLightningAddress(bad)).toBe(false);
      expect(() => parseLightningAddress(bad)).toThrow(/Lightning Address/);
    }
  });
});

/** Encode a BOLT12 TLV stream as an offer string (test helper, no checksum). */
function encodeOffer(records: [number, Uint8Array][]): string {
  const bytes: number[] = [];
  for (const [t, v] of records) {
    const bigsize = (n: number) => (n < 0xfd ? [n] : [0xfd, n >> 8, n & 0xff]);
    bytes.push(...bigsize(t), ...bigsize(v.length), ...v);
  }
  const words = bech32.toWords(Uint8Array.from(bytes));
  return 'lno1' + words.map((w) => BECH32_CHARSET[w]).join('');
}
const utf8 = (s: string) => new TextEncoder().encode(s);

describe('BOLT12 offers (display-level)', () => {
  it('decodes description, issuer, amount and expiry', () => {
    const offer = encodeOffer([
      [8, Uint8Array.from([0x01, 0x86, 0xa0])], // 100000 msat
      [10, utf8('Coffee')],
      [14, Uint8Array.from([0x65, 0x00, 0x00, 0x00])],
      [18, utf8('Bob’s Café')],
      [20, Uint8Array.from([5])],
      [22, new Uint8Array(33).fill(2)],
      [99, Uint8Array.from([1])],
    ]);
    const o = decodeBolt12Offer(offer);
    expect(o).toMatchObject({
      description: 'Coffee',
      issuer: 'Bob’s Café',
      amountMsat: 100000n,
      networks: ['mainnet'],
      quantityMax: 5n,
    });
    expect(o.absoluteExpiry).toBe(0x65000000);
    expect(o.issuerId).toBe('02'.repeat(33));
    // '+' continuations and whitespace are allowed
    expect(decodeBolt12Offer(`${offer.slice(0, 20)}+\n  ${offer.slice(20)}`).description).toBe(
      'Coffee',
    );
    expect(decodeBolt12Offer(offer.toUpperCase()).description).toBe('Coffee');
  });

  it('handles fiat currency amounts and chains', () => {
    const signet = '00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6'
      .match(/../g)!
      .reverse()
      .join('');
    const chain = Uint8Array.from(signet.match(/../g)!.map((h) => Number.parseInt(h, 16)));
    const o = decodeBolt12Offer(
      encodeOffer([
        [2, chain],
        [6, utf8('USD')],
        [8, Uint8Array.from([0x01, 0xf4])],
        [10, utf8('x')],
      ]),
    );
    expect(o).toMatchObject({ currency: 'USD', currencyAmount: 500n, networks: ['signet'] });
    expect(o.amountMsat).toBeUndefined();
    const big = decodeBolt12Offer(encodeOffer([[10, utf8('a'.repeat(300))]]));
    expect(big.description).toHaveLength(300);
  });

  it('classifies and rejects', () => {
    expect(bolt12Kind('lno1qq')).toBe('offer');
    expect(bolt12Kind('lightning:LNI1QQ')).toBe('invoice');
    expect(bolt12Kind('lnr1qq')).toBe('invoice-request');
    expect(bolt12Kind('lnbc1')).toBeNull();
    expect(looksLikeBolt12Offer('lno1abc')).toBe(true);
    expect(() => decodeBolt12Offer('lnr1qq')).toThrow(/not a BOLT12 offer/);
    expect(() => decodeBolt12Offer('lno1Qq')).toThrow(/invalid/);
    expect(() => decodeBolt12Offer('lno1bbb')).toThrow(/invalid characters/);
    expect(() => decodeBolt12Offer(encodeOffer([[10, utf8('abc')]]).slice(0, -2))).toThrow(
      /malformed/,
    );
  });
});
