import { decodeBolt11 } from '@orange-ui/core';
import {
  AdapterError,
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentUpdate,
  type RequestOptions,
  type SubscribeOptions,
} from './types.js';
import {
  assertNoBrowserSecret,
  defaultFetch,
  pollStatus,
  requestJson,
  trimUrl,
  type FetchLike,
} from './util.js';

export interface LnbitsAdapterOptions {
  /** LNbits instance URL, or your proxy that adds `X-Api-Key` server-side. */
  baseUrl: string;
  /** Invoice/read key. Server-side only. */
  apiKey?: string;
  dangerouslyAllowBrowserKey?: boolean;
  fetch?: FetchLike;
}

interface LnbitsCreated {
  payment_hash: string;
  payment_request?: string;
  bolt11?: string;
}

interface LnbitsStatus {
  paid: boolean;
  /** LNbits >= 1.0: "pending" | "success" | "failed" (an expired invoice is "failed"). */
  status?: string;
  preimage?: string | null;
  details?: {
    /** ISO date string in LNbits >= 1.0, unix seconds in older versions. */
    expiry?: string | number | null;
    status?: string;
    pending?: boolean;
    labels?: string[];
  };
}

/** Parse LNbits' expiry (ISO string or unix seconds) to unix ms. */
function parseExpiry(v: string | number | null | undefined): number | undefined {
  if (typeof v === 'number') return v * 1000;
  if (typeof v === 'string' && v) {
    const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
    return Number.isNaN(ms) ? undefined : ms;
  }
  return undefined;
}

/** LNbits (Lightning-only) adapter. Invoice id = payment hash. */
export class LnbitsAdapter implements PaymentAdapter {
  readonly name = 'lnbits';
  readonly #o: LnbitsAdapterOptions;
  readonly #fetch: FetchLike;
  readonly #expiries = new Map<string, number>();

  constructor(opts: LnbitsAdapterOptions) {
    assertNoBrowserSecret(this.name, opts.apiKey, opts.dangerouslyAllowBrowserKey);
    this.#o = opts;
    this.#fetch = opts.fetch ?? defaultFetch;
  }

  #req<T>(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = this.#o.apiKey ? { 'X-Api-Key': this.#o.apiKey } : {};
    return requestJson<T>(this.name, this.#fetch, `${trimUrl(this.#o.baseUrl)}${path}`, {
      ...init,
      headers,
    });
  }

  async createInvoice(req: CreateInvoiceRequest, opts: RequestOptions = {}): Promise<Invoice> {
    if (req.methods && !req.methods.includes('lightning')) {
      throw new AdapterError(this.name, 'lnbits: only Lightning payments are supported');
    }
    const body: Record<string, unknown> = {
      out: false,
      memo: req.description ?? '',
      expiry: req.expirySeconds,
    };
    if (req.fiat) {
      body.amount = req.fiat.amount;
      body.unit = req.fiat.currency;
    } else if (req.amountSats !== undefined) body.amount = Number(req.amountSats);
    else throw new AdapterError(this.name, 'lnbits: an amount is required');
    if (req.orderId || req.metadata) body.extra = { orderId: req.orderId, ...req.metadata };
    const created = await this.#req<LnbitsCreated>('/api/v1/payments', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const pr = created.payment_request ?? created.bolt11;
    if (!pr) throw new AdapterError(this.name, 'lnbits: no payment request returned');
    const decoded = decodeBolt11(pr);
    this.#expiries.set(created.payment_hash, decoded.expiresAt * 1000);
    return {
      id: created.payment_hash,
      amountSats: (decoded.amountMsat ?? 0n) / 1000n,
      fiat: req.fiat,
      description: req.description,
      lightning: pr,
      network: decoded.network,
      status: 'pending',
      createdAt: decoded.timestamp * 1000,
      expiresAt: decoded.expiresAt * 1000,
    };
  }

  async getStatus(invoiceId: string, opts: RequestOptions = {}): Promise<PaymentUpdate> {
    const s = await this.#req<LnbitsStatus>(`/api/v1/payments/${encodeURIComponent(invoiceId)}`, {
      signal: opts.signal,
    });
    // Prefer what LNbits reports, so a fresh adapter (e.g. after a server restart) agrees with one
    // that created the invoice.
    const expiresAt = parseExpiry(s.details?.expiry) ?? this.#expiries.get(invoiceId);
    const state = s.status ?? s.details?.status;
    const expired =
      !s.paid &&
      (state === 'expired' ||
        Boolean(s.details?.labels?.includes('expired')) ||
        (expiresAt !== undefined && Date.now() > expiresAt));
    return {
      invoiceId,
      status: s.paid ? 'paid' : expired ? 'expired' : state === 'failed' ? 'failed' : 'pending',
      method: 'lightning',
      preimage: s.paid ? (s.preimage ?? undefined) : undefined,
      updatedAt: Date.now(),
    };
  }

  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void, opts?: SubscribeOptions) {
    return pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, {
      intervalMs: 2000,
      ...opts,
    });
  }

  /** LNbits invoices cannot be cancelled; they simply expire. */
  async cancel(): Promise<void> {}
}

export const createLnbitsAdapter = (opts: LnbitsAdapterOptions) => new LnbitsAdapter(opts);
