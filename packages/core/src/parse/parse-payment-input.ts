import { decodeAddress, type AddressInfo } from '../address/address.js';
import { parseBip21, type Bip21 } from '../bip21/bip21.js';
import { OrangeError, toErrorInfo, type ErrorInfo } from '../errors.js';
import { decodeBolt11, looksLikeBolt11, type Bolt11Invoice } from '../lightning/bolt11.js';
import { bolt12Kind, decodeBolt12Offer, type Bolt12Offer } from '../lightning/bolt12.js';
import {
  parseLightningAddress,
  looksLikeLightningAddress,
  type LightningAddress,
} from '../lightning/lightning-address.js';
import { decodeLnurl, looksLikeLnurl, type Lnurl } from '../lightning/lnurl.js';
import { NETWORK_LABELS, type Network } from '../network.js';

/** Everything a user might paste or scan, classified. */
export type PaymentInput =
  | { type: 'onchain-address'; raw: string; address: AddressInfo; network: Network }
  | {
      type: 'bip21';
      raw: string;
      uri: Bip21;
      /** Decoded `lightning=` invoice when present and valid. */
      invoice?: Bolt11Invoice;
      /** Decoded `lno=` offer when present and valid. */
      offer?: Bolt12Offer;
      network?: Network;
    }
  | { type: 'bolt11'; raw: string; invoice: Bolt11Invoice; network: Network }
  | { type: 'bolt12-offer'; raw: string; offer: Bolt12Offer }
  | { type: 'lnurl'; raw: string; lnurl: Lnurl }
  | { type: 'lightning-address'; raw: string; lightningAddress: LightningAddress }
  | {
      type: 'invalid';
      raw: string;
      /** Best guess of what the user meant, for better messages. */
      detected?: 'onchain-address' | 'bip21' | 'bolt11' | 'bolt12' | 'lnurl' | 'lightning-address';
      error: ErrorInfo;
    };

export type PaymentInputType = PaymentInput['type'];

export interface ParseOptions {
  /** Reject destinations for other networks with a clear message. */
  network?: Network;
  /** Restrict accepted types (e.g. on-chain only). */
  accept?: Exclude<PaymentInputType, 'invalid'>[];
}

const invalid = (
  raw: string,
  error: unknown,
  detected?: Extract<PaymentInput, { type: 'invalid' }>['detected'],
): PaymentInput => ({ type: 'invalid', raw, detected, error: toErrorInfo(error) });

function checkNetwork(actual: Network, expected?: Network): void {
  if (!expected || actual === expected) return;
  const testnets: Network[] = ['testnet', 'testnet4', 'signet'];
  if (testnets.includes(actual) && testnets.includes(expected)) return;
  throw new OrangeError(
    'wrong-network',
    `This is for ${NETWORK_LABELS[actual]}, but ${NETWORK_LABELS[expected]} is expected.`,
  );
}

const TYPE_LABEL: Record<Exclude<PaymentInputType, 'invalid'>, string> = {
  'onchain-address': 'Bitcoin addresses',
  bip21: 'payment links',
  bolt11: 'Lightning invoices',
  'bolt12-offer': 'Lightning offers',
  lnurl: 'LNURLs',
  'lightning-address': 'Lightning Addresses',
};

/**
 * Classify and decode anything a user pastes or scans: on-chain address, BIP21 URI (incl.
 * unified QR), BOLT11 invoice, BOLT12 offer, LNURL or Lightning Address. Never throws.
 */
export function parsePaymentInput(input: string, opts: ParseOptions = {}): PaymentInput {
  const result = classify(input, opts);
  if (result.type !== 'invalid' && opts.accept && !opts.accept.includes(result.type)) {
    const accepted = opts.accept.map((t) => TYPE_LABEL[t]).join(', ');
    return invalid(
      result.raw,
      new OrangeError('unrecognized', `This isn't supported here. Accepted: ${accepted}.`),
      result.type === 'bolt12-offer' ? 'bolt12' : result.type,
    );
  }
  return result;
}

function classify(input: string, opts: ParseOptions): PaymentInput {
  const raw = input.trim();
  if (!raw) return invalid(raw, new OrangeError('empty', 'Paste or scan a payment destination.'));
  const s = raw.replace(/^lightning:/i, '');

  if (/^bitcoin:/i.test(raw)) {
    try {
      const uri = parseBip21(raw, opts.network);
      const out: Extract<PaymentInput, { type: 'bip21' }> = { type: 'bip21', raw, uri };
      if (uri.addressInfo) out.network = pickNetwork(uri.addressInfo.networks, opts.network);
      if (uri.lightning) {
        try {
          out.invoice = decodeBolt11(uri.lightning);
          checkNetwork(out.invoice.network, opts.network);
          out.network ??= out.invoice.network;
        } catch (e) {
          // An invalid lightning param must not block a valid on-chain fallback.
          if (!uri.address) throw e;
        }
      }
      if (uri.offer) {
        try {
          out.offer = decodeBolt12Offer(uri.offer);
        } catch (e) {
          if (!uri.address && !out.invoice) throw e;
        }
      }
      return out;
    } catch (e) {
      return invalid(raw, e, 'bip21');
    }
  }

  if (looksLikeBolt11(s)) {
    try {
      const invoice = decodeBolt11(s);
      checkNetwork(invoice.network, opts.network);
      return { type: 'bolt11', raw, invoice, network: invoice.network };
    } catch (e) {
      return invalid(raw, e, 'bolt11');
    }
  }

  const b12 = bolt12Kind(s);
  if (b12) {
    if (b12 !== 'offer') {
      return invalid(
        raw,
        new OrangeError('unrecognized', 'Paste a Lightning offer (lno…), not an invoice request.'),
        'bolt12',
      );
    }
    try {
      const offer = decodeBolt12Offer(s);
      if (
        opts.network &&
        offer.networks.length &&
        !offer.networks.some((n) => sameFamily(n, opts.network!))
      ) {
        checkNetwork(offer.networks[0]!, opts.network);
      }
      return { type: 'bolt12-offer', raw, offer };
    } catch (e) {
      return invalid(raw, e, 'bolt12');
    }
  }

  if (looksLikeLnurl(s)) {
    try {
      return { type: 'lnurl', raw, lnurl: decodeLnurl(s) };
    } catch (e) {
      return invalid(raw, e, 'lnurl');
    }
  }

  if (s.includes('@')) {
    if (looksLikeLightningAddress(s)) {
      return { type: 'lightning-address', raw, lightningAddress: parseLightningAddress(s) };
    }
    return invalid(
      raw,
      new OrangeError('invalid-lightning-address', 'This is not a valid Lightning Address.'),
      'lightning-address',
    );
  }

  try {
    const address = decodeAddress(s, opts.network);
    return {
      type: 'onchain-address',
      raw,
      address,
      network: pickNetwork(address.networks, opts.network),
    };
  } catch (e) {
    const err = e as OrangeError;
    if (err.code === 'unknown-prefix' || err.code === 'invalid-characters') {
      if (!/^(bc|tb|bcrt)1|^[123mn2]/i.test(s)) {
        return invalid(
          raw,
          new OrangeError(
            'unrecognized',
            "This doesn't look like a Bitcoin address, invoice or Lightning Address.",
          ),
        );
      }
    }
    return invalid(raw, e, 'onchain-address');
  }
}

const sameFamily = (a: Network, b: Network) =>
  a === b ||
  (['testnet', 'testnet4', 'signet'].includes(a) && ['testnet', 'testnet4', 'signet'].includes(b));

const pickNetwork = (networks: Network[], preferred?: Network): Network =>
  preferred && networks.includes(preferred) ? preferred : networks[0]!;
