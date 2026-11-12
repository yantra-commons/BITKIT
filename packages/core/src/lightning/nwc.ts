import { OrangeError } from '../errors.js';

/** Parsed NIP-47 connection string. `secret` is sensitive: keep it in memory only. */
export interface NwcConnection {
  walletPubkey: string;
  relays: string[];
  secret: string;
  lud16?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

export const looksLikeNwcUri = (s: string) => /^nostr\+walletconnect:\/\//i.test(s.trim());

/**
 * Parse a Nostr Wallet Connect URI:
 * `nostr+walletconnect://<pubkey>?relay=wss://…&secret=<hex>[&lud16=…]`.
 * Throws `OrangeError` with a user-facing message. Never logs the secret.
 */
export function parseNwcUri(input: string): NwcConnection {
  const s = input.trim();
  const fail = (msg: string): never => {
    throw new OrangeError('invalid-uri', msg);
  };
  if (!looksLikeNwcUri(s)) fail('This is not a Nostr Wallet Connect link.');
  const rest = s.replace(/^nostr\+walletconnect:\/\//i, '');
  const q = rest.indexOf('?');
  const pubkey = (q === -1 ? rest : rest.slice(0, q)).toLowerCase();
  if (!HEX64.test(pubkey)) fail('The wallet key in this connection link is invalid.');
  const params = new URLSearchParams(q === -1 ? '' : rest.slice(q + 1));
  const relays = params.getAll('relay').filter((r) => /^wss?:\/\//i.test(r));
  if (!relays.length) fail('This connection link has no relay.');
  const secret = (params.get('secret') ?? '').toLowerCase();
  if (!HEX64.test(secret)) fail('This connection link has no valid secret.');
  const lud16 = params.get('lud16') ?? undefined;
  return { walletPubkey: pubkey, relays, secret, ...(lud16 ? { lud16 } : {}) };
}
