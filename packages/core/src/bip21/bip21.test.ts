import { describe, expect, it } from 'vitest';
import { buildBip21, isBip21, parseBip21 } from './bip21.js';

// The BIP-21 example address (175tWpb8…) has an invalid checksum, so the examples below use a
// valid P2PKH address from BOLT-11 instead. See the dedicated test.
const BIP21_EXAMPLE_ADDRESS = '175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W';
const LUKE = '1RustyRX2oai4EYYDpQGWvEL62BBGqN9T';
const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const INVOICE =
  'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';

describe('BIP21 examples', () => {
  it('parses address only', () => {
    expect(parseBip21(`bitcoin:${LUKE}`)).toMatchObject({ address: LUKE, params: {} });
  });

  it('parses label', () => {
    expect(parseBip21(`bitcoin:${LUKE}?label=Luke-Jr`).label).toBe('Luke-Jr');
  });

  it('parses amount, label and message', () => {
    const r = parseBip21(`bitcoin:${LUKE}?amount=20.3&label=Luke-Jr`);
    expect(r.amountMsat).toBe(2_030_000_000_000n);
    const r2 = parseBip21(
      `bitcoin:${LUKE}?amount=50&label=Luke-Jr&message=Donation%20for%20project%20xyz`,
    );
    expect(r2).toMatchObject({
      amountMsat: 5_000_000_000_000n,
      message: 'Donation for project xyz',
    });
  });

  it('rejects unknown req- params, ignores unknown optional params', () => {
    expect(() =>
      parseBip21(
        `bitcoin:${LUKE}?req-somethingyoudontunderstand=50&req-somethingelseyoudontget=999`,
      ),
    ).toThrow(/isn't supported/);
    expect(
      parseBip21(`bitcoin:${LUKE}?somethingyoudontunderstand=50&somethingelseyoudontget=999`)
        .params,
    ).toEqual({
      somethingyoudontunderstand: '50',
      somethingelseyoudontget: '999',
    });
  });
});

describe('BIP21 parsing details', () => {
  it('rejects the BIP-21 example address, whose checksum is invalid', () => {
    expect(() => parseBip21(`bitcoin:${BIP21_EXAMPLE_ADDRESS}`)).toThrow(
      /address in this payment link/,
    );
  });

  it('accepts upper-case unified QR and lightning-only URIs', () => {
    const r = parseBip21(
      `BITCOIN:${SEGWIT.toUpperCase()}?amount=0.0025&LIGHTNING=${INVOICE.toUpperCase()}`,
    );
    expect(r.address).toBe(SEGWIT);
    expect(r.lightning).toBe(INVOICE.toUpperCase());
    expect(r.amountMsat).toBe(250_000_000n);
    expect(parseBip21(`bitcoin:?lightning=${INVOICE}`).address).toBeUndefined();
    expect(parseBip21('bitcoin:?lno=lno1qq').offer).toBe('lno1qq');
    expect(parseBip21(`bitcoin:${SEGWIT}?pj=https://example.com/pj&flag`)).toMatchObject({
      payjoin: 'https://example.com/pj',
      params: { flag: '' },
    });
    expect(parseBip21(`bitcoin:${SEGWIT}?amount=.5`).amountMsat).toBe(50_000_000_000n);
    expect(parseBip21(`bitcoin:${SEGWIT}?label=a&label=b`).label).toBe('a');
    expect(parseBip21(`bitcoin:${SEGWIT}?req-pj=https://x`).params['req-pj']).toBe('https://x');
  });

  it('rejects malformed input', () => {
    expect(() => parseBip21(SEGWIT)).toThrow(/not a bitcoin:/);
    expect(() => parseBip21('bitcoin:')).toThrow(/no destination/);
    expect(() => parseBip21('bitcoin:notanaddress')).toThrow(/address in this payment link/);
    expect(() => parseBip21(`bitcoin:${SEGWIT}?amount=1e5`)).toThrow(/amount/);
    expect(() => parseBip21(`bitcoin:${SEGWIT}?amount=0.000000001`)).toThrow(/amount/);
    expect(() => parseBip21(`bitcoin:${SEGWIT}?amount=-1`)).toThrow(/amount/);
    expect(() => parseBip21(`bitcoin:${SEGWIT}?label=%E0%A4%A`)).toThrow(/malformed/);
    expect(() => parseBip21(`bitcoin:${SEGWIT}`, 'testnet')).toThrow(/Mainnet address/);
    expect(isBip21(' bitcoin:x')).toBe(true);
    expect(isBip21('lightning:x')).toBe(false);
  });
});

describe('buildBip21', () => {
  it('builds and round-trips', () => {
    const uri = buildBip21({
      address: SEGWIT,
      amountSats: 250_000n,
      label: 'Café & Co',
      message: 'Order #42',
    });
    expect(uri).toBe(
      `bitcoin:${SEGWIT}?amount=0.0025&label=Caf%C3%A9%20%26%20Co&message=Order%20%2342`,
    );
    expect(parseBip21(uri)).toMatchObject({
      amountMsat: 250_000_000n,
      label: 'Café & Co',
      message: 'Order #42',
    });
  });

  it('builds upper-case unified QR', () => {
    const uri = buildBip21({
      address: SEGWIT,
      amountMsat: 250_000_000n,
      lightning: INVOICE,
      offer: 'lno1qq',
      uppercase: true,
    });
    expect(uri).toBe(
      `BITCOIN:${SEGWIT.toUpperCase()}?amount=0.0025&LIGHTNING=${INVOICE.toUpperCase()}&LNO=LNO1QQ`,
    );
    expect(parseBip21(uri).lightning?.toLowerCase()).toBe(INVOICE);
    expect(buildBip21({ address: LUKE, uppercase: true })).toBe(`BITCOIN:${LUKE}`);
    expect(buildBip21({ lightning: INVOICE, offer: 'lno1qq', params: { pj: 'https://x/y' } })).toBe(
      `bitcoin:?pj=https%3A%2F%2Fx%2Fy&lightning=${INVOICE}&lno=lno1qq`,
    );
  });

  it('rejects sub-sat on-chain amounts', () => {
    expect(() => buildBip21({ address: SEGWIT, amountMsat: 1500n })).toThrow(/whole sats/);
  });
});
