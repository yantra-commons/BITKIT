import { OrangeError } from '../errors.js';
import { bech32, decodeUtf8, encodeUtf8 } from '../encoding.js';

export type LnurlKind = 'pay' | 'withdraw' | 'auth' | 'channel' | 'unknown';

export interface Lnurl {
  /** Decoded https (or http for .onion) URL. */
  url: string;
  /** Kind if knowable without fetching (LUD-17 scheme or `tag` query param). */
  kind: LnurlKind;
  /** Original input. */
  raw: string;
}

const LUD17: Record<string, LnurlKind> = {
  lnurlp: 'pay',
  lnurlw: 'withdraw',
  lnurlc: 'channel',
  keyauth: 'auth',
};
const TAG_KIND: Record<string, LnurlKind> = {
  payRequest: 'pay',
  withdrawRequest: 'withdraw',
  login: 'auth',
  channelRequest: 'channel',
};

const kindFromUrl = (url: URL): LnurlKind =>
  TAG_KIND[url.searchParams.get('tag') ?? ''] ?? 'unknown';

export const looksLikeLnurl = (s: string) => {
  const t = s.trim().replace(/^lightning:/i, '');
  return /^lnurl1[02-9ac-hj-np-z]+$/i.test(t) || /^(lnurlp|lnurlw|lnurlc|keyauth):\/\//i.test(t);
};

/** Decode a bech32 LNURL (LUD-01) or LUD-17 URL. Throws `OrangeError`. */
export function decodeLnurl(input: string): Lnurl {
  const raw = input.trim();
  const s = raw.replace(/^lightning:/i, '');
  const scheme = /^(lnurlp|lnurlw|lnurlc|keyauth):\/\//i.exec(s);
  let urlString: string;
  let kind: LnurlKind | undefined;
  if (scheme) {
    const host = s.slice(scheme[0].length).split(/[/?#]/)[0] ?? '';
    const proto = host.endsWith('.onion') ? 'http://' : 'https://';
    urlString = proto + s.slice(scheme[0].length);
    kind = LUD17[scheme[1]!.toLowerCase()];
  } else {
    if (s !== s.toLowerCase() && s !== s.toUpperCase()) {
      throw new OrangeError('mixed-case', 'This LNURL is invalid.');
    }
    try {
      const { prefix, words } = bech32.decode(s.toLowerCase() as `${string}1${string}`, false);
      if (prefix !== 'lnurl') throw new Error('prefix');
      urlString = decodeUtf8(bech32.fromWords(words));
    } catch (e) {
      throw new OrangeError('invalid-lnurl', 'This LNURL has a typo or is incomplete.', {
        cause: e,
      });
    }
  }
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (e) {
    throw new OrangeError('invalid-lnurl', 'This LNURL does not contain a valid link.', {
      cause: e,
    });
  }
  const onion = url.hostname.endsWith('.onion');
  if (url.protocol !== 'https:' && !(onion && url.protocol === 'http:')) {
    throw new OrangeError('invalid-lnurl', 'LNURL links must use https.');
  }
  return { url: url.toString(), kind: kind ?? kindFromUrl(url), raw };
}

/** Encode a URL as an upper-case bech32 LNURL (for QR codes). */
export function encodeLnurl(url: string): string {
  return bech32.encode('lnurl', bech32.toWords(encodeUtf8(url)), false).toUpperCase();
}
