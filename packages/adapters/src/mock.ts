import {
  buildBip21,
  encodeAddress,
  encodeUnsignedBolt11,
  fiatToMsat,
  MSAT_PER_SAT,
  type Network,
} from '@bitkit-ui/core';
import {
  AdapterError,
  isTerminalStatus,
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentUpdate,
  type Unsubscribe,
} from './types.js';

/** Scripted outcome for every invoice the mock creates. */
export type MockScenario =
  'lightning' | 'onchain' | 'underpaid' | 'overpaid' | 'expired' | 'failed' | 'manual';

export interface MockAdapterOptions {
  scenario?: MockScenario;
  /** ms between simulated steps. Default 1500. */
  stepMs?: number;
  /** Network for generated destinations. Default 'signet' so demos never show mainnet addresses. */
  network?: Network;
  /** Confirmations required for on-chain "paid". Default 3. */
  requiredConfirmations?: number;
  /** Default invoice lifetime. Default 900 s. */
  expirySeconds?: number;
  /** Fiat price used when a fiat amount is requested. Default 60000 USD. */
  fiatPrice?: string;
  /** Injectable clock (unix ms). */
  now?: () => number;
  /** Seed for deterministic ids/hashes. */
  seed?: number;
  /** Simulated network latency for createInvoice, ms. Default 400. */
  latencyMs?: number;
}

interface MockState {
  invoice: Invoice;
  update: PaymentUpdate;
  listeners: Set<(u: PaymentUpdate) => void>;
  timers: ReturnType<typeof setTimeout>[];
}

/** Small deterministic PRNG (not cryptographic — mock data only). */
function prng(seed: number) {
  let s = seed >>> 0 || 0x9e3779b9;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      out[i] = s & 0xff;
    }
    return out;
  };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    });
  });

/**
 * Deterministic adapter that simulates every payment path. Used by the docs, tests and the
 * playground. Generated invoices and addresses are well-formed but cannot be paid.
 */
export class MockAdapter implements PaymentAdapter {
  readonly name = 'mock';
  scenario: MockScenario;
  readonly #opts: Required<Omit<MockAdapterOptions, 'scenario' | 'now'>> & { now: () => number };
  readonly #state = new Map<string, MockState>();
  readonly #rand: (n: number) => Uint8Array;
  #counter = 0;

  constructor(opts: MockAdapterOptions = {}) {
    this.scenario = opts.scenario ?? 'lightning';
    this.#opts = {
      stepMs: opts.stepMs ?? 1500,
      network: opts.network ?? 'signet',
      requiredConfirmations: opts.requiredConfirmations ?? 3,
      expirySeconds: opts.expirySeconds ?? 900,
      fiatPrice: opts.fiatPrice ?? '60000',
      now: opts.now ?? (() => Date.now()),
      seed: opts.seed ?? 21,
      latencyMs: opts.latencyMs ?? 400,
    };
    this.#rand = prng(this.#opts.seed);
  }

  async createInvoice(
    req: CreateInvoiceRequest,
    opts: { signal?: AbortSignal } = {},
  ): Promise<Invoice> {
    await sleep(this.#opts.latencyMs, opts.signal);
    let amountSats = req.amountSats;
    if (amountSats === undefined && req.fiat) {
      const msat = fiatToMsat(req.fiat.amount, {
        currency: req.fiat.currency,
        price: this.#opts.fiatPrice,
      });
      amountSats = (msat + MSAT_PER_SAT / 2n) / MSAT_PER_SAT;
    }
    if (amountSats === undefined || amountSats <= 0n) {
      throw new AdapterError(this.name, 'mock: an amount greater than zero is required');
    }
    const id = `mock_${++this.#counter}`;
    const now = this.#opts.now();
    const expirySeconds = req.expirySeconds ?? this.#opts.expirySeconds;
    const methods: PaymentMethod[] = req.methods ?? ['lightning', 'onchain'];
    const network = this.#opts.network;
    const description = req.description ?? 'Mock payment';
    const lightning = methods.includes('lightning')
      ? encodeUnsignedBolt11({
          network,
          amountMsat: amountSats * MSAT_PER_SAT,
          timestamp: Math.floor(now / 1000),
          paymentHash: this.#rand(32),
          paymentSecret: this.#rand(32),
          description,
          expiry: expirySeconds,
        })
      : undefined;
    const address = methods.includes('onchain')
      ? encodeAddress('p2wpkh', this.#rand(20), network)
      : undefined;
    const invoice: Invoice = {
      id,
      amountSats,
      fiat: req.fiat,
      description,
      lightning,
      onchain: address
        ? { address, uri: buildBip21({ address, amountSats, label: description }) }
        : undefined,
      network,
      status: 'pending',
      createdAt: now,
      expiresAt: now + expirySeconds * 1000,
      mock: true,
    };
    this.#state.set(id, {
      invoice,
      update: { invoiceId: id, status: 'pending', updatedAt: now },
      listeners: new Set(),
      timers: [],
    });
    return invoice;
  }

  #get(id: string): MockState {
    const s = this.#state.get(id);
    if (!s) throw new AdapterError(this.name, `mock: unknown invoice ${id}`, 404);
    return s;
  }

  async getStatus(invoiceId: string): Promise<PaymentUpdate> {
    return { ...this.#get(invoiceId).update };
  }

  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void): Unsubscribe {
    const s = this.#get(invoiceId);
    s.listeners.add(onUpdate);
    onUpdate({ ...s.update });
    if (s.listeners.size === 1 && s.timers.length === 0 && !isTerminalStatus(s.update.status))
      this.#script(s);
    return () => {
      s.listeners.delete(onUpdate);
    };
  }

  async cancel(invoiceId: string): Promise<void> {
    this.simulate(invoiceId, 'cancelled');
  }

  /** Push a status manually (playground buttons, tests). */
  simulate(invoiceId: string, status: PaymentStatus, extra: Partial<PaymentUpdate> = {}): void {
    const s = this.#get(invoiceId);
    if (isTerminalStatus(s.update.status)) return;
    s.update = { ...s.update, ...extra, status, invoiceId, updatedAt: this.#opts.now() };
    s.invoice.status = status;
    for (const l of [...s.listeners]) l({ ...s.update });
    if (isTerminalStatus(status)) {
      s.timers.forEach(clearTimeout);
      s.timers = [];
    }
  }

  /** Convenience: simulate a successful payment. */
  simulatePayment(invoiceId: string, method: PaymentMethod = 'lightning'): void {
    const amount = this.#get(invoiceId).invoice.amountSats;
    this.simulate(invoiceId, 'paid', {
      method,
      amountReceivedSats: amount,
      ...(method === 'lightning'
        ? { preimage: '00'.repeat(32) }
        : {
            confirmations: this.#opts.requiredConfirmations,
            requiredConfirmations: this.#opts.requiredConfirmations,
            txid: 'ab'.repeat(32),
          }),
    });
  }

  #script(s: MockState) {
    const id = s.invoice.id;
    const amt = s.invoice.amountSats;
    const req = this.#opts.requiredConfirmations;
    const txid = 'ab'.repeat(32);
    const steps: [number, () => void][] = [];
    const at = (n: number, fn: () => void) => steps.push([n * this.#opts.stepMs, fn]);
    switch (this.scenario) {
      case 'lightning':
        at(2, () => this.simulatePayment(id, 'lightning'));
        break;
      case 'onchain':
        at(1, () =>
          this.simulate(id, 'detected', {
            method: 'onchain',
            amountReceivedSats: amt,
            confirmations: 0,
            requiredConfirmations: req,
            txid,
          }),
        );
        for (let c = 1; c < req; c++) {
          at(1 + c, () => this.simulate(id, 'confirming', { confirmations: c }));
        }
        at(1 + req, () => this.simulate(id, 'paid', { confirmations: req }));
        break;
      case 'underpaid':
        at(1, () =>
          this.simulate(id, 'underpaid', {
            method: 'onchain',
            amountReceivedSats: amt / 2n,
            confirmations: 0,
            txid,
          }),
        );
        break;
      case 'overpaid':
        at(1, () =>
          this.simulate(id, 'detected', {
            method: 'onchain',
            amountReceivedSats: amt + amt / 10n,
            confirmations: 0,
            requiredConfirmations: req,
            txid,
          }),
        );
        at(2, () => this.simulate(id, 'overpaid', { confirmations: req }));
        break;
      case 'expired':
        at(3, () => this.simulate(id, 'expired'));
        break;
      case 'failed':
        at(2, () => this.simulate(id, 'failed'));
        break;
      case 'manual':
        break;
    }
    // Real expiry for anything still open.
    const expiresIn = (s.invoice.expiresAt ?? 0) - this.#opts.now();
    if (expiresIn > 0) steps.push([expiresIn, () => this.simulate(id, 'expired')]);
    s.timers = steps.map(([ms, fn]) => setTimeout(fn, ms));
  }

  /** Stop all timers (call in tests / on page teardown). */
  dispose(): void {
    for (const s of this.#state.values()) s.timers.forEach(clearTimeout);
    this.#state.clear();
  }
}

export const createMockAdapter = (opts?: MockAdapterOptions) => new MockAdapter(opts);
