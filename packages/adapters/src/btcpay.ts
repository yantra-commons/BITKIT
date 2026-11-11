import { buildBip21, type Network } from '@bitkit-ui/core';
import {
  AdapterError,
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentUpdate,
  type RequestOptions,
  type SubscribeOptions,
} from './types.js';
import {
  assertNoBrowserSecret,
  defaultFetch,
  parseSats,
  pollStatus,
  requestJson,
  trimUrl,
  type FetchLike,
} from './util.js';

export interface BtcPayAdapterOptions {
  /**
   * BTCPay Server URL, or (in browsers) your own proxy that forwards `/api/v1/stores/{storeId}/…`
   * and adds the `Authorization` header server-side.
   */
  baseUrl: string;
  storeId: string;
  /** Greenfield API key. Server-side only. */
  apiKey?: string;
  /** Escape hatch for trusted environments (e.g. Electron with a restricted key). */
  dangerouslyAllowBrowserKey?: boolean;
  network?: Network;
  fetch?: FetchLike;
}

interface GfInvoice {
  id: string;
  status: 'New' | 'Processing' | 'Expired' | 'Invalid' | 'Settled';
  additionalStatus?: 'None' | 'PaidLate' | 'PaidPartial' | 'Marked' | 'Invalid' | 'PaidOver';
  amount: string;
  currency: string;
  createdTime?: number;
  expirationTime?: number;
  checkoutLink?: string;
  metadata?: { itemDesc?: string; orderId?: string };
}

interface GfPaymentMethod {
  paymentMethodId?: string;
  paymentMethod?: string;
  destination: string;
  paymentLink?: string;
  amount?: string;
  totalPaid?: string;
  due?: string;
  payments?: { id?: string; status?: string; value?: string }[];
}

const isLightning = (m: GfPaymentMethod) =>
  /LN|Lightning/i.test(m.paymentMethodId ?? m.paymentMethod ?? '');
const isChain = (m: GfPaymentMethod) =>
  /^BTC(-CHAIN)?$|OnChain/i.test(m.paymentMethodId ?? m.paymentMethod ?? '');

/** Decimal BTC string → sats (BTCPay reports per-method amounts in BTC). */
const btcToSats = (v?: string) => {
  if (!v) return 0n;
  const [i = '0', f = ''] = v.split('.');
  return BigInt(i) * 100_000_000n + BigInt((f + '00000000').slice(0, 8));
};

/** Map Greenfield status to the kit's PaymentStatus. */
export function mapBtcPayStatus(
  s: GfInvoice['status'],
  extra?: GfInvoice['additionalStatus'],
): PaymentStatus {
  switch (s) {
    case 'Settled':
      return extra === 'PaidOver' ? 'overpaid' : 'paid';
    case 'Processing':
      return 'confirming';
    case 'Expired':
      return extra === 'PaidPartial' ? 'underpaid' : 'expired';
    case 'Invalid':
      return 'failed';
    default:
      return extra === 'PaidPartial' ? 'underpaid' : 'pending';
  }
}

/** BTCPay Server (Greenfield API) adapter. */
export class BtcPayAdapter implements PaymentAdapter {
  readonly name = 'btcpay';
  readonly #o: BtcPayAdapterOptions;
  readonly #fetch: FetchLike;

  constructor(opts: BtcPayAdapterOptions) {
    assertNoBrowserSecret(this.name, opts.apiKey, opts.dangerouslyAllowBrowserKey);
    this.#o = opts;
    this.#fetch = opts.fetch ?? defaultFetch;
  }

  #url(path: string) {
    return `${trimUrl(this.#o.baseUrl)}/api/v1/stores/${encodeURIComponent(this.#o.storeId)}${path}`;
  }

  #req<T>(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = this.#o.apiKey
      ? { Authorization: `token ${this.#o.apiKey}` }
      : {};
    return requestJson<T>(this.name, this.#fetch, this.#url(path), { ...init, headers });
  }

  async createInvoice(req: CreateInvoiceRequest, opts: RequestOptions = {}): Promise<Invoice> {
    const body = {
      amount: req.fiat
        ? req.fiat.amount
        : req.amountSats !== undefined
          ? req.amountSats.toString()
          : undefined,
      currency: req.fiat ? req.fiat.currency : 'SATS',
      metadata: { orderId: req.orderId, itemDesc: req.description, ...req.metadata },
      checkout: {
        expirationMinutes: req.expirySeconds ? Math.ceil(req.expirySeconds / 60) : undefined,
        paymentMethods: req.methods?.map((m) => (m === 'lightning' ? 'BTC-LN' : 'BTC-CHAIN')),
      },
    };
    const inv = await this.#req<GfInvoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const methods = await this.#req<GfPaymentMethod[]>(`/invoices/${inv.id}/payment-methods`, {
      signal: opts.signal,
    });
    return this.#toInvoice(inv, methods);
  }

  #toInvoice(inv: GfInvoice, methods: GfPaymentMethod[]): Invoice {
    const ln = methods.find(isLightning);
    const chain = methods.find(isChain);
    const due =
      btcToSats(chain?.amount ?? ln?.amount) ||
      (inv.currency.toUpperCase() === 'SATS' ? parseSats(inv.amount) : 0n);
    const network = this.#o.network ?? 'mainnet';
    const lightning = ln?.destination.replace(/^lightning:/i, '');
    return {
      id: inv.id,
      amountSats: due,
      fiat:
        inv.currency.toUpperCase() !== 'SATS' && inv.currency.toUpperCase() !== 'BTC'
          ? { amount: inv.amount, currency: inv.currency }
          : undefined,
      description: inv.metadata?.itemDesc,
      lightning,
      onchain: chain
        ? {
            address: chain.destination,
            uri: chain.paymentLink ?? buildBip21({ address: chain.destination, amountSats: due }),
          }
        : undefined,
      network,
      status: mapBtcPayStatus(inv.status, inv.additionalStatus),
      createdAt: (inv.createdTime ?? 0) * 1000,
      expiresAt: inv.expirationTime ? inv.expirationTime * 1000 : undefined,
      checkoutUrl: inv.checkoutLink,
    };
  }

  async getStatus(invoiceId: string, opts: RequestOptions = {}): Promise<PaymentUpdate> {
    const inv = await this.#req<GfInvoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
      signal: opts.signal,
    });
    const status = mapBtcPayStatus(inv.status, inv.additionalStatus);
    let method: PaymentMethod | undefined;
    let received: bigint | undefined;
    if (status !== 'pending' && status !== 'expired') {
      try {
        const methods = await this.#req<GfPaymentMethod[]>(
          `/invoices/${encodeURIComponent(invoiceId)}/payment-methods`,
          { signal: opts.signal },
        );
        const paid = methods.find((m) => btcToSats(m.totalPaid) > 0n);
        if (paid) {
          method = isLightning(paid) ? 'lightning' : 'onchain';
          received = btcToSats(paid.totalPaid);
        }
      } catch (e) {
        if (!(e instanceof AdapterError)) throw e;
      }
    }
    return { invoiceId, status, method, amountReceivedSats: received, updatedAt: Date.now() };
  }

  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void, opts?: SubscribeOptions) {
    return pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, opts);
  }

  async cancel(invoiceId: string, opts: RequestOptions = {}): Promise<void> {
    await this.#req<void>(`/invoices/${encodeURIComponent(invoiceId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'Invalid' }),
      signal: opts.signal,
    });
  }
}

export const createBtcPayAdapter = (opts: BtcPayAdapterOptions) => new BtcPayAdapter(opts);
