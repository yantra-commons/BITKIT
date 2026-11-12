import { buildBip21, type Network } from '@orange-ui/core';
import {
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
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

export interface OpenNodeAdapterOptions {
  /** `https://api.opennode.com` (or dev-api) — or your proxy that adds the key server-side. */
  baseUrl?: string;
  /** Invoice-permission API key. Server-side only. */
  apiKey?: string;
  dangerouslyAllowBrowserKey?: boolean;
  network?: Network;
  fetch?: FetchLike;
}

interface Charge {
  id: string;
  status: string;
  amount: number;
  description?: string;
  created_at?: number;
  fiat_value?: number;
  currency?: string;
  hosted_checkout_url?: string;
  lightning_invoice?: { payreq: string; expires_at?: number };
  chain_invoice?: { address: string };
  missing_amt?: number;
  transactions?: { status?: string; tx?: string }[];
}

/** Map OpenNode charge statuses to PaymentStatus. */
export function mapOpenNodeStatus(s: string): PaymentStatus {
  switch (s) {
    case 'paid':
      return 'paid';
    case 'processing':
      return 'confirming';
    case 'underpaid':
      return 'underpaid';
    case 'expired':
      return 'expired';
    case 'refunded':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** OpenNode charges adapter. */
export class OpenNodeAdapter implements PaymentAdapter {
  readonly name = 'opennode';
  readonly #o: OpenNodeAdapterOptions;
  readonly #fetch: FetchLike;

  constructor(opts: OpenNodeAdapterOptions = {}) {
    assertNoBrowserSecret(this.name, opts.apiKey, opts.dangerouslyAllowBrowserKey);
    this.#o = opts;
    this.#fetch = opts.fetch ?? defaultFetch;
  }

  #req<T>(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = this.#o.apiKey ? { Authorization: this.#o.apiKey } : {};
    return requestJson<{ data: T }>(
      this.name,
      this.#fetch,
      `${trimUrl(this.#o.baseUrl ?? 'https://api.opennode.com')}${path}`,
      {
        ...init,
        headers,
      },
    ).then((r) => r.data);
  }

  async createInvoice(req: CreateInvoiceRequest, opts: RequestOptions = {}): Promise<Invoice> {
    const body = {
      amount: req.fiat ? req.fiat.amount : Number(req.amountSats ?? 0n),
      currency: req.fiat ? req.fiat.currency : 'BTC',
      description: req.description,
      order_id: req.orderId,
      ttl: req.expirySeconds ? Math.ceil(req.expirySeconds / 60) : undefined,
      metadata: req.metadata,
    };
    const c = await this.#req<Charge>('/v1/charges', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    return this.#toInvoice(c, req);
  }

  #toInvoice(c: Charge, req?: CreateInvoiceRequest): Invoice {
    const amountSats = parseSats(c.amount);
    const methods = req?.methods ?? ['lightning', 'onchain'];
    const address = methods.includes('onchain') ? c.chain_invoice?.address : undefined;
    return {
      id: c.id,
      amountSats,
      fiat: req?.fiat,
      description: c.description,
      lightning: methods.includes('lightning') ? c.lightning_invoice?.payreq : undefined,
      onchain: address ? { address, uri: buildBip21({ address, amountSats }) } : undefined,
      network: this.#o.network ?? 'mainnet',
      status: mapOpenNodeStatus(c.status),
      createdAt: (c.created_at ?? 0) * 1000,
      expiresAt: c.lightning_invoice?.expires_at
        ? c.lightning_invoice.expires_at * 1000
        : undefined,
      checkoutUrl: c.hosted_checkout_url,
    };
  }

  async getStatus(invoiceId: string, opts: RequestOptions = {}): Promise<PaymentUpdate> {
    const c = await this.#req<Charge>(`/v1/charge/${encodeURIComponent(invoiceId)}`, {
      signal: opts.signal,
    });
    const status = mapOpenNodeStatus(c.status);
    const tx = c.transactions?.find((t) => t.tx);
    return {
      invoiceId,
      status,
      method: tx ? 'onchain' : status === 'paid' ? 'lightning' : undefined,
      txid: tx?.tx,
      amountReceivedSats:
        c.missing_amt !== undefined ? parseSats(c.amount) - parseSats(c.missing_amt) : undefined,
      updatedAt: Date.now(),
    };
  }

  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void, opts?: SubscribeOptions) {
    return pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, opts);
  }

  /** OpenNode has no cancel endpoint for charges; they expire on their own. */
  async cancel(): Promise<void> {}
}

export const createOpenNodeAdapter = (opts?: OpenNodeAdapterOptions) => new OpenNodeAdapter(opts);
