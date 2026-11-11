import type { Network } from '@bitkit-ui/core';
import {
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentStatus,
  type PaymentUpdate,
  type RequestOptions,
  type SubscribeOptions,
  type Unsubscribe,
} from './types.js';
import {
  defaultFetch,
  parseSats,
  pollStatus,
  requestJson,
  trimUrl,
  type FetchLike,
} from './util.js';

export interface HttpAdapterOptions {
  /** Your backend, e.g. `/api/payments`. */
  baseUrl: string;
  /** Extra headers (e.g. a CSRF token). Never put provider secrets here. */
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  /**
   * Optional Server-Sent Events endpoint for push updates: `{baseUrl}/{id}/events` by default
   * when `sse: true`. Each event's data is a JSON PaymentUpdate. Falls back to polling.
   */
  sse?: boolean | ((invoiceId: string) => string);
  fetch?: FetchLike;
  /** Default network when the backend omits it. */
  network?: Network;
}

/** JSON wire shape: same as Invoice / PaymentUpdate, with amounts as strings or numbers. */
type Wire<T> = {
  [K in keyof T]: T[K] extends bigint | undefined ? string | number | undefined : T[K];
};

/**
 * Generic adapter for your own backend (which talks to any provider and handles webhooks).
 *
 * Endpoints:
 * - `POST {baseUrl}` → Invoice JSON
 * - `GET {baseUrl}/{id}` → PaymentUpdate JSON
 * - `POST {baseUrl}/{id}/cancel` (optional)
 * - `GET {baseUrl}/{id}/events` (optional SSE)
 */
export class HttpAdapter implements PaymentAdapter {
  readonly name = 'http';
  readonly #o: HttpAdapterOptions;
  readonly #fetch: FetchLike;

  constructor(opts: HttpAdapterOptions) {
    this.#o = opts;
    this.#fetch = opts.fetch ?? defaultFetch;
  }

  #req<T>(path: string, init: RequestInit = {}) {
    return requestJson<T>(this.name, this.#fetch, `${trimUrl(this.#o.baseUrl)}${path}`, {
      ...init,
      credentials: this.#o.credentials,
      headers: this.#o.headers,
    });
  }

  async createInvoice(req: CreateInvoiceRequest, opts: RequestOptions = {}): Promise<Invoice> {
    const body = JSON.stringify({ ...req, amountSats: req.amountSats?.toString() });
    const w = await this.#req<Wire<Invoice>>('', { method: 'POST', body, signal: opts.signal });
    return {
      ...w,
      amountSats: parseSats(w.amountSats),
      network: w.network ?? this.#o.network ?? 'mainnet',
      status: w.status ?? 'pending',
    } as Invoice;
  }

  static parseUpdate(w: Wire<PaymentUpdate>, invoiceId: string): PaymentUpdate {
    return {
      ...w,
      invoiceId: w.invoiceId ?? invoiceId,
      status: w.status as PaymentStatus,
      amountReceivedSats:
        w.amountReceivedSats === undefined ? undefined : parseSats(w.amountReceivedSats),
      updatedAt: w.updatedAt ?? Date.now(),
    };
  }

  async getStatus(invoiceId: string, opts: RequestOptions = {}): Promise<PaymentUpdate> {
    const w = await this.#req<Wire<PaymentUpdate>>(`/${encodeURIComponent(invoiceId)}`, {
      signal: opts.signal,
    });
    return HttpAdapter.parseUpdate(w, invoiceId);
  }

  subscribe(
    invoiceId: string,
    onUpdate: (u: PaymentUpdate) => void,
    opts?: SubscribeOptions,
  ): Unsubscribe {
    const ES = (globalThis as { EventSource?: typeof EventSource }).EventSource;
    if (this.#o.sse && ES) {
      const url =
        typeof this.#o.sse === 'function'
          ? this.#o.sse(invoiceId)
          : `${trimUrl(this.#o.baseUrl)}/${encodeURIComponent(invoiceId)}/events`;
      const es = new ES(url, { withCredentials: this.#o.credentials === 'include' });
      let fallback: Unsubscribe | undefined;
      es.onmessage = (ev) => {
        try {
          onUpdate(HttpAdapter.parseUpdate(JSON.parse(ev.data as string), invoiceId));
        } catch {
          /* ignore malformed events */
        }
      };
      es.onerror = () => {
        es.close();
        fallback ??= pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, opts);
      };
      return () => {
        es.close();
        fallback?.();
      };
    }
    return pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, opts);
  }

  async cancel(invoiceId: string, opts: RequestOptions = {}): Promise<void> {
    await this.#req<void>(`/${encodeURIComponent(invoiceId)}/cancel`, {
      method: 'POST',
      signal: opts.signal,
    });
  }
}

export const createHttpAdapter = (opts: HttpAdapterOptions) => new HttpAdapter(opts);
