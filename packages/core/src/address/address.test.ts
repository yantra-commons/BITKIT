import { describe, expect, it } from 'vitest';
import { hex } from '@scure/base';
import {
  ADDRESS_TYPE_LABELS,
  decodeAddress,
  encodeAddress,
  isValidAddress,
  validateAddress,
  type AddressType,
} from './address.js';
import { addressForScreenReader, chunkAddress, truncateMiddle } from './display.js';
import { base58check } from '../encoding.js';
import { compatibleNetworks, explorerUrl, isNetwork } from '../network.js';

// BIP-350 "valid segwit addresses" with their scriptPubKeys.
const VALID_SEGWIT: [string, string][] = [
  ['BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', '0014751e76e8199196d454941c45d1b3a323f1433bd6'],
  [
    'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
    '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262',
  ],
  [
    'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y',
    '5128751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd6',
  ],
  ['BC1SW50QGDZ25J', '6002751e'],
  ['bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs', '5210751e76e8199196d454941c45d1b3a323'],
  [
    'tb1qqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesrxh6hy',
    '0020000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433',
  ],
  [
    'tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c',
    '5120000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433',
  ],
  [
    'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
    '512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  ],
];

// BIP-350 "invalid segwit addresses".
const INVALID_SEGWIT = [
  'tc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq5zuyut',
  'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd',
  'tb1z0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqglt7rf',
  'BC1S0XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ54WELL',
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh',
  'tb1q0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq24jc47',
  'bc1p38j9r5y49hruaue7wxjce0updqjuyyx0kh56v8s25huc6995vvpql3jow4',
  'BC130XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ7ZWS8R',
  'bc1pw5dgrnzv',
  'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v8n0nx0muaewav253zgeav',
  'BC1QR508D6QEJXTDG4Y5R3ZARVARYV98GJ9P',
  'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq47Zagq',
  'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v07qwwzcrf',
  'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vpggkg4j',
  'bc1gmk9yu',
];

// Base58 addresses from BOLT-11 examples.
const BASE58: [string, AddressType, 'mainnet' | 'testnet'][] = [
  ['1RustyRX2oai4EYYDpQGWvEL62BBGqN9T', 'p2pkh', 'mainnet'],
  ['3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX', 'p2sh', 'mainnet'],
  ['mk2QpYatsKicvFVuTAQLBryyccRXMUaGHP', 'p2pkh', 'testnet'],
];

describe('BIP-350 valid segwit addresses', () => {
  it.each(VALID_SEGWIT)('%s', (addr, spk) => {
    const info = decodeAddress(addr);
    const version = info.witnessVersion!;
    const opcode = version === 0 ? '00' : (0x50 + version).toString(16);
    const pushLen = (info.program.length / 2).toString(16).padStart(2, '0');
    expect(`${opcode}${pushLen}${info.program}`).toBe(spk);
    expect(info.address).toBe(addr.toLowerCase());
    // round-trip through the encoder
    expect(encodeAddress(info.type, hex.decode(info.program), info.networks[0]!, version)).toBe(
      info.address,
    );
  });

  it('classifies types', () => {
    expect(decodeAddress(VALID_SEGWIT[0]![0]).type).toBe('p2wpkh');
    expect(decodeAddress(VALID_SEGWIT[1]![0]).type).toBe('p2wsh');
    expect(decodeAddress(VALID_SEGWIT[7]![0]).type).toBe('p2tr');
    expect(decodeAddress(VALID_SEGWIT[3]![0]).type).toBe('witness-unknown');
    expect(decodeAddress(VALID_SEGWIT[7]![0]).encoding).toBe('bech32m');
    expect(decodeAddress(VALID_SEGWIT[1]![0]).networks).toEqual(['testnet', 'testnet4', 'signet']);
  });
});

describe('BIP-350 invalid segwit addresses', () => {
  it.each(INVALID_SEGWIT)('%s', (addr) => {
    const r = validateAddress(addr);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error.message.length).toBeGreaterThan(10);
  });

  it('reports specific reasons', () => {
    const code = (a: string) => {
      const r = validateAddress(a);
      return r.valid ? null : r.error.code;
    };
    expect(code(INVALID_SEGWIT[0]!)).toBe('unknown-prefix');
    expect(code(INVALID_SEGWIT[1]!)).toBe('invalid-checksum');
    expect(code(INVALID_SEGWIT[7]!)).toBe('invalid-witness-version');
    expect(code(INVALID_SEGWIT[8]!)).toBe('invalid-program-length');
    expect(code(INVALID_SEGWIT[10]!)).toBe('invalid-program-length');
    expect(code(INVALID_SEGWIT[11]!)).toBe('mixed-case');
    expect(code(INVALID_SEGWIT[12]!)).toBe('invalid-padding');
    expect(code('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toBe('invalid-checksum');
    expect(code('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3ti')).toBe('invalid-characters');
    expect(code('')).toBe('empty');
    expect(code(`bc1q${'q'.repeat(90)}`)).toBe('invalid-length');
  });
});

describe('base58 addresses', () => {
  it.each(BASE58)('%s is %s on %s', (addr, type, net) => {
    const info = decodeAddress(addr);
    expect(info.type).toBe(type);
    expect(info.networks[0]).toBe(net);
    expect(info.encoding).toBe('base58');
    expect(encodeAddress(type, hex.decode(info.program), net)).toBe(addr);
  });

  it('detects test p2sh and rejects bad checksums / versions', () => {
    const p2shTest = encodeAddress('p2sh', new Uint8Array(20).fill(7), 'testnet');
    expect(decodeAddress(p2shTest)).toMatchObject({
      type: 'p2sh',
      networks: ['testnet', 'testnet4', 'signet', 'regtest'],
    });
    expect(validateAddress('1RustyRX2oai4EYYDpQGWvEL62BBGqN9U')).toMatchObject({
      valid: false,
      error: { code: 'invalid-checksum' },
    });
    expect(validateAddress('1RustyRX2oai4EYYDpQGWvEL62BBGqN9O')).toMatchObject({
      valid: false,
      error: { code: 'invalid-characters' },
    });
    // version byte 0x30 (Litecoin) — valid base58check but not Bitcoin
    expect(validateAddress('LVg2kJoFNg45Nbpy53h7Fe1wKyeXVRhMH9')).toMatchObject({ valid: false });
    expect(validateAddress(base58check.encode(new Uint8Array(20)))).toMatchObject({
      valid: false,
      error: { code: 'invalid-length' },
    });
  });
});

describe('network checks', () => {
  it('enforces expected network with a clear message', () => {
    const r = validateAddress(
      'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
      'mainnet',
    );
    expect(r).toMatchObject({ valid: false, error: { code: 'wrong-network' } });
    if (!r.valid)
      expect(r.error.message).toBe('This is a Testnet address, but Mainnet is expected.');
    expect(isValidAddress('1RustyRX2oai4EYYDpQGWvEL62BBGqN9T', 'mainnet')).toBe(true);
    expect(validateAddress('1RustyRX2oai4EYYDpQGWvEL62BBGqN9T', 'signet')).toMatchObject({
      error: { message: expect.stringContaining('Mainnet address') },
    });
    const regtest = encodeAddress('p2wpkh', new Uint8Array(20), 'regtest');
    expect(regtest.startsWith('bcrt1')).toBe(true);
    expect(decodeAddress(regtest, 'regtest').networks).toEqual(['regtest']);
  });

  it('builds explorer urls', () => {
    expect(explorerUrl('tx', 'abc')).toBe('https://mempool.space/tx/abc');
    expect(explorerUrl('address', 'tb1x', 'signet')).toBe(
      'https://mempool.space/signet/address/tb1x',
    );
    expect(explorerUrl('block', '1', 'regtest')).toBeNull();
    expect(explorerUrl('tx', 'abc', 'regtest', 'http://localhost:8080/')).toBe(
      'http://localhost:8080/tx/abc',
    );
    expect(compatibleNetworks('signet')).toContain('testnet');
    expect(compatibleNetworks('regtest')).toEqual(['regtest']);
    expect(compatibleNetworks('mainnet')).toEqual(['mainnet']);
    expect(isNetwork('signet')).toBe(true);
    expect(isNetwork('litecoin')).toBe(false);
  });

  it('has labels for all types', () => {
    expect(Object.keys(ADDRESS_TYPE_LABELS)).toHaveLength(6);
  });
});

describe('address display helpers', () => {
  it('chunks', () => {
    expect(chunkAddress('bc1qar0srrr7', 4)).toEqual(['bc1q', 'ar0s', 'rrr7']);
    expect(chunkAddress('abc', 0)).toEqual(['abc']);
  });

  it('truncates in the middle', () => {
    const a = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    expect(truncateMiddle(a)).toBe(`${a.slice(0, 8)}…${a.slice(-8)}`);
    expect(truncateMiddle(a, { start: 4, end: 4, ellipsis: '...' })).toBe('bc1q...5mdq');
    expect(truncateMiddle('short')).toBe('short');
  });

  it('reads addresses for screen readers', () => {
    expect(addressForScreenReader('bc1qar0s')).toBe('b c 1 q, a r 0 s');
    expect(addressForScreenReader('1Rus')).toBe('1 capital R u s');
  });
});
