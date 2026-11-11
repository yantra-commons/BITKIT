import type { FiatRate, Network, RecommendedFees } from '@bitkit-ui/core';

/** Lifecycle of a payment request. Terminal states: paid, overpaid, expired, failed, cancelled. */
export type PaymentStatus =
  | 'pending'
  | 'detected'
  | 'confirming'
  | 'paid'
  | 'underpaid'
  | 'overpaid'
  | 'expired'
  | 'failed'
  | 'cancelled';

export type PaymentMethod = 'lightning' | 'onchain';

export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  'paid',
  'overpaid',
  'expired',
  'failed',
  'cancelled',
];
export const isTerminalStatus = (s: PaymentStatus) => TERMINAL_STATUSES.includes(s);
/** Statuses where the merchant has received at least the requested amount. */
export const isPaidStatus = (s: PaymentStatus) => s === 'paid' || s === 'overpaid';

export interface FiatAmount {
  /** Exact decimal string, e.g. "12.50". */
  amount: string;
  /** ISO 4217 code. */
  currency: string;
}

export interface CreateInvoiceRequest {
  /** Amount in sats. Provide this or `fiat`. */
  amountSats?: bigint;
  /** Fiat-denominated amount; the provider converts at its own rate. */
  fiat?: FiatAmount;
  description?: string;
  orderId?: string;
  metadata?: Record<string, string>;
  /** Payment methods to offer. Default: both. */
  methods?: PaymentMethod[];
  /** Requested lifetime in seconds. */
  expirySeconds?: number;
}

/** A payment request returned by an adapter. */
export interface Invoice {
  id: string;
  /** Amount due in sats (after any fiat conversion by the provider). */
  amountSats: bigint;
  fiat?: FiatAmount;
  description?: string;
  /** BOLT11 payment request. */
  lightning?: string;
  /** On-chain destination. */
  onchain?: { address: string; uri?: string };
  network: Network;
  status: PaymentStatus;
  /** Unix ms. */
  createdAt: number;
  /** Unix ms. */
  expiresAt?: number;
  /** Hosted checkout URL, when the provider has one. */
  checkoutUrl?: string;
  /** True for simulated invoices that cannot be paid. */
  mock?: boolean;
}

export interface PaymentUpdate {
  invoiceId: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  amountReceivedSats?: bigint;
  confirmations?: number;
  requiredConfirmations?: number;
  txid?: string;
  preimage?: string;
  /** Unix ms. */
  updatedAt: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface SubscribeOptions extends RequestOptions {
  /** Poll interval for polling-based adapters. Default 3000 ms. */
  intervalMs?: number;
}

export type Unsubscribe = () => void;

/**
 * The small interface every payment provider implements. Components only ever talk to this,
 * never to a vendor API directly.
 */
export interface PaymentAdapter {
  readonly name: string;
  createInvoice(req: CreateInvoiceRequest, opts?: RequestOptions): Promise<Invoice>;
  getStatus(invoiceId: string, opts?: RequestOptions): Promise<PaymentUpdate>;
  /** Receive status updates until a terminal status or unsubscribe. */
  subscribe(
    invoiceId: string,
    onUpdate: (u: PaymentUpdate) => void,
    opts?: SubscribeOptions,
  ): Unsubscribe;
  /** Cancel/invalidate a pending invoice when the provider supports it. */
  cancel(invoiceId: string, opts?: RequestOptions): Promise<void>;
}

/** Fiat price source. */
export interface FiatRateAdapter {
  getRate(currency: string, opts?: RequestOptions): Promise<FiatRate>;
}

/** Fee estimate source. */
export interface FeeRateAdapter {
  getRecommendedFees(opts?: RequestOptions): Promise<RecommendedFees>;
}

/** Error raised by adapters, with the HTTP status when relevant. */
export class AdapterError extends Error {
  readonly status?: number;
  readonly adapter: string;
  constructor(adapter: string, message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdapterError';
    this.adapter = adapter;
    this.status = status;
  }
}
