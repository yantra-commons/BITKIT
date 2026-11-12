import { OrangeError } from '../errors.js';

/** A LUD-16 Lightning Address such as `satoshi@example.com`. */
export interface LightningAddress {
  address: string;
  username: string;
  domain: string;
  /** LNURL-pay endpoint: https://<domain>/.well-known/lnurlp/<username> */
  lnurlpUrl: string;
}

const RE =
  /^([a-z0-9\-_.+]+)@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}|localhost)(:\d{1,5})?$/i;

export const looksLikeLightningAddress = (s: string) =>
  RE.test(s.trim().replace(/^(lightning:|₿)/i, ''));

/** Parse a Lightning Address. Throws `OrangeError`. Accepts a leading "₿" or "lightning:". */
export function parseLightningAddress(input: string): LightningAddress {
  const s = input.trim().replace(/^(lightning:|₿)/i, '');
  const m = RE.exec(s);
  if (!m) {
    throw new OrangeError('invalid-lightning-address', 'This is not a valid Lightning Address.');
  }
  const username = m[1]!.toLowerCase();
  const domain = (m[2]! + (m[3] ?? '')).toLowerCase();
  const proto = domain.split(':')[0]!.endsWith('.onion') ? 'http' : 'https';
  return {
    address: `${username}@${domain}`,
    username,
    domain,
    lnurlpUrl: `${proto}://${domain}/.well-known/lnurlp/${encodeURIComponent(username)}`,
  };
}
