import { describe, expect, it } from 'vitest';
import vectors from '../../test/fixtures/bolt11-invoice-test.json' with { type: 'json' };
import { encodeLnurl } from '../lightning/lnurl.js';
import { parsePaymentInput } from './parse-payment-input.js';

const INVOICE = (vectors as { invoice: string }[])[1]!.invoice;
const TESTNET_INVOICE = (vectors as { invoice: string }[])[4]!.invoice;
const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TB = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7';

describe('parsePaymentInput', () => {
  it('classifies on-chain addresses', () => {
    const r = parsePaymentInput(`  ${SEGWIT}  `);
    expect(r).toMatchObject({ type: 'onchain-address', network: 'mainnet' });
    expect(parsePaymentInput(TB, { network: 'signet' })).toMatchObject({
      type: 'onchain-address',
      network: 'signet',
    });
  });

  it('classifies BIP21 with unified QR', () => {
    const r = parsePaymentInput(`bitcoin:${SEGWIT}?amount=0.0025&lightning=${INVOICE}`);
    expect(r.type).toBe('bip21');
    if (r.type === 'bip21') {
      expect(r.invoice?.amountMsat).toBe(250_000_000n);
      expect(r.network).toBe('mainnet');
    }
    const lnOnly = parsePaymentInput(`bitcoin:?lightning=${INVOICE}`);
    expect(lnOnly).toMatchObject({ type: 'bip21', network: 'mainnet' });
  });

  it('keeps the on-chain part when the lightning param is broken', () => {
    const r = parsePaymentInput(`bitcoin:${SEGWIT}?lightning=lnbc1garbage&lno=lno1bbb`);
    expect(r.type).toBe('bip21');
    if (r.type === 'bip21') {
      expect(r.invoice).toBeUndefined();
      expect(r.offer).toBeUndefined();
    }
    expect(parsePaymentInput('bitcoin:?lightning=lnbc1garbage')).toMatchObject({
      type: 'invalid',
      detected: 'bip21',
    });
    expect(parsePaymentInput('bitcoin:?lno=lno1bbb')).toMatchObject({
      type: 'invalid',
      detected: 'bip21',
    });
  });

  it('classifies BOLT11 with and without lightning: prefix', () => {
    expect(parsePaymentInput(INVOICE)).toMatchObject({ type: 'bolt11', network: 'mainnet' });
    expect(parsePaymentInput(`LIGHTNING:${INVOICE.toUpperCase()}`)).toMatchObject({
      type: 'bolt11',
    });
    expect(parsePaymentInput(`${INVOICE.slice(0, -1)}x`)).toMatchObject({
      type: 'invalid',
      detected: 'bolt11',
      error: { code: 'invalid-checksum' },
    });
  });

  it('classifies LNURL, Lightning Address and offers', () => {
    expect(parsePaymentInput(encodeLnurl('https://a.com/x'))).toMatchObject({ type: 'lnurl' });
    expect(parsePaymentInput('lnurlp://a.com/x')).toMatchObject({
      type: 'lnurl',
      lnurl: { kind: 'pay' },
    });
    expect(parsePaymentInput('lnurl1qqqq')).toMatchObject({ type: 'invalid', detected: 'lnurl' });
    expect(parsePaymentInput('alice@example.com')).toMatchObject({
      type: 'lightning-address',
      lightningAddress: { username: 'alice' },
    });
    expect(parsePaymentInput('alice@nowhere')).toMatchObject({
      type: 'invalid',
      detected: 'lightning-address',
    });
    expect(
      parsePaymentInput(
        'lno1pg257enxv4ezqcneype82um50ynhxgrwdajx283qfwdpl28qqmc78ymlvhmxcsywdk5wrjnj36jryg488qwlrnzyjczs',
      ),
    ).toMatchObject({ type: 'bolt12-offer' });
    expect(parsePaymentInput('lni1qqq')).toMatchObject({ type: 'invalid', detected: 'bolt12' });
    expect(parsePaymentInput('lno1bbb')).toMatchObject({ type: 'invalid', detected: 'bolt12' });
  });

  it('enforces network', () => {
    expect(parsePaymentInput(SEGWIT, { network: 'testnet' })).toMatchObject({
      type: 'invalid',
      error: { code: 'wrong-network' },
    });
    expect(parsePaymentInput(INVOICE, { network: 'signet' })).toMatchObject({
      type: 'invalid',
      error: { code: 'wrong-network' },
    });
    expect(parsePaymentInput(TESTNET_INVOICE, { network: 'signet' })).toMatchObject({
      type: 'bolt11',
    });
    expect(
      parsePaymentInput(`bitcoin:?lightning=${INVOICE}`, { network: 'regtest' }),
    ).toMatchObject({ type: 'invalid' });
    expect(
      parsePaymentInput(
        'lno1pg257enxv4ezqcneype82um50ynhxgrwdajx283qfwdpl28qqmc78ymlvhmxcsywdk5wrjnj36jryg488qwlrnzyjczs',
        { network: 'regtest' },
      ),
    ).toMatchObject({ type: 'invalid', error: { code: 'wrong-network' } });
  });

  it('restricts accepted types', () => {
    const r = parsePaymentInput(INVOICE, { accept: ['onchain-address', 'bip21'] });
    expect(r).toMatchObject({ type: 'invalid', detected: 'bolt11' });
    if (r.type === 'invalid') expect(r.error.message).toContain('Bitcoin addresses, payment links');
    expect(
      parsePaymentInput(
        'lno1pg257enxv4ezqcneype82um50ynhxgrwdajx283qfwdpl28qqmc78ymlvhmxcsywdk5wrjnj36jryg488qwlrnzyjczs',
        { accept: ['bolt11'] },
      ),
    ).toMatchObject({ detected: 'bolt12' });
  });

  it('explains garbage input', () => {
    expect(parsePaymentInput('')).toMatchObject({ type: 'invalid', error: { code: 'empty' } });
    expect(parsePaymentInput('hello world')).toMatchObject({
      type: 'invalid',
      error: { code: 'unrecognized' },
    });
    expect(parsePaymentInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toMatchObject({
      type: 'invalid',
      detected: 'onchain-address',
      error: { code: 'invalid-checksum' },
    });
    expect(parsePaymentInput('bitcoin:nope')).toMatchObject({ type: 'invalid', detected: 'bip21' });
  });
});
