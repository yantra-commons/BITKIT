import { bech32, encodeUtf8 } from '../encoding.js';
import type { Network } from '../network.js';
import type { Msat } from '../units/amount.js';

const PREFIX: Record<Network, string> = {
  mainnet: 'bc',
  testnet: 'tb',
  testnet4: 'tb',
  signet: 'tbs',
  regtest: 'bcrt',
};

export interface UnsignedBolt11Fields {
  network: Network;
  amountMsat?: Msat | null;
  /** Unix seconds. */
  timestamp: number;
  paymentHash: Uint8Array;
  paymentSecret: Uint8Array;
  description?: string;
  /** Seconds. */
  expiry?: number;
}

function amountPart(msat: Msat): string {
  if (msat % 100_000_000_000n === 0n) return `${msat / 100_000_000_000n}`;
  if (msat % 100_000_000n === 0n) return `${msat / 100_000_000n}m`;
  if (msat % 100_000n === 0n) return `${msat / 100_000n}u`;
  if (msat % 100n === 0n) return `${msat / 100n}n`;
  return `${msat * 10n}p`;
}

function intWords(n: number): number[] {
  const w: number[] = [];
  do {
    w.unshift(n % 32);
    n = Math.floor(n / 32);
  } while (n > 0);
  return w;
}

function tag(type: number, data: number[]): number[] {
  return [type, Math.floor(data.length / 32), data.length % 32, ...data];
}

/**
 * Encode a well-formed BOLT11 string with an all-zero signature. For tests, demos and mock
 * adapters only: wallets will reject it because the signature is invalid, which is exactly
 * what a simulated invoice should do.
 */
export function encodeUnsignedBolt11(f: UnsignedBolt11Fields): string {
  const hrp = `ln${PREFIX[f.network]}${f.amountMsat ? amountPart(f.amountMsat) : ''}`;
  const ts = intWords(f.timestamp);
  const words = [
    ...new Array(7 - ts.length).fill(0),
    ...ts,
    ...tag(1, bech32.toWords(f.paymentHash)),
    ...tag(16, bech32.toWords(f.paymentSecret)),
    ...tag(13, bech32.toWords(encodeUtf8(f.description ?? ''))),
    ...(f.expiry !== undefined ? tag(6, intWords(f.expiry)) : []),
    ...tag(5, [16, 8, 0]), // features: var_onion_optin (8) + payment_secret (14), as in "sgq"
    ...new Array(104).fill(0),
  ];
  return bech32.encode(hrp, words, false);
}
