import { decodeBolt11 } from '@bitkit-ui/core';
import {
  AdapterError,
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentUpdate,
  type RequestOptions,
  type SubscribeOptions,
} from './types.js';
import { pollStatus } from './util.js';

/**
 * Minimal NIP-47 client surface used by the adapter. `@getalby/sdk`'s `NWCClient` satisfies it,
 * so the kit never ships Nostr crypto itself:
 *
 * ```ts
 * import { nwc } from '@getalby/sdk';
 * const client = new nwc.NWCClient({ nostrWalletConnectUrl });
 * const adapter = createNwcAdapter({ client });
 * ```
 */
export interface NwcClient {
  makeInvoice(req: { amount: number; description?: string; expiry?: number }): Promise<{
    invoice: string;
    payment_hash: string;
    expires_at?: number;
  }>;
  lookupInvoice(req: { payment_hash?: string; invoice?: string }): Promise<{
    settled_at?: number | null;
    preimage?: string | null;
    expires_at?: number;
    state?: string;
  }>;
}

export interface NwcAdapterOptions {
  /**
   * A NIP-47 client. Use a **receive-only** connection (make_invoice + lookup_invoice
   * permissions) when this runs in a browser: anyone who can read the page can read the secret.
   */
  client: NwcClient;
}

/** Receive payments into a wallet over Nostr Wallet Connect (Lightning only). */
export class NwcAdapter implements PaymentAdapter {
  readonly name = 'nwc';
  readonly #client: NwcClient;

  constructor(opts: NwcAdapterOptions) {
    if (!opts?.client) throw new AdapterError('nwc', 'nwc: a NIP-47 client is required');
    this.#client = opts.client;
  }

  async createInvoice(req: CreateInvoiceRequest): Promise<Invoice> {
    if (req.amountSats === undefined) {
      throw new AdapterError(
        this.name,
        'nwc: amountSats is required (convert fiat before calling)',
      );
    }
    if (req.methods && !req.methods.includes('lightning')) {
      throw new AdapterError(this.name, 'nwc: only Lightning payments are supported');
    }
    const res = await this.#client.makeInvoice({
      amount: Number(req.amountSats * 1000n),
      description: req.description,
      expiry: req.expirySeconds,
    });
    const decoded = decodeBolt11(res.invoice);
    return {
      id: res.payment_hash,
      amountSats: req.amountSats,
      description: req.description,
      lightning: res.invoice,
      network: decoded.network,
      status: 'pending',
      createdAt: decoded.timestamp * 1000,
      expiresAt: (res.expires_at ?? decoded.expiresAt) * 1000,
    };
  }

  async getStatus(invoiceId: string, _opts?: RequestOptions): Promise<PaymentUpdate> {
    const r = await this.#client.lookupInvoice({ payment_hash: invoiceId });
    const settled = Boolean(r.settled_at) || r.state === 'settled';
    const expired =
      !settled &&
      (r.state === 'expired' || (r.expires_at !== undefined && Date.now() / 1000 > r.expires_at));
    return {
      invoiceId,
      status: settled ? 'paid' : expired ? 'expired' : r.state === 'failed' ? 'failed' : 'pending',
      method: 'lightning',
      preimage: settled ? (r.preimage ?? undefined) : undefined,
      updatedAt: Date.now(),
    };
  }

  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void, opts?: SubscribeOptions) {
    return pollStatus((signal) => this.getStatus(invoiceId, { signal }), onUpdate, {
      intervalMs: 2000,
      ...opts,
    });
  }

  async cancel(): Promise<void> {}
}

export const createNwcAdapter = (opts: NwcAdapterOptions) => new NwcAdapter(opts);
