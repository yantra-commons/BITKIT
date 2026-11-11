import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import {
  buildBip21,
  countdownForScreenReader,
  formatCountdown,
  fromMsat,
  MSAT_PER_SAT,
  type FiatRate,
} from '@bitkit-ui/core';
import {
  isPaidStatus,
  isTerminalStatus,
  type CreateInvoiceRequest,
  type Invoice,
  type PaymentAdapter,
  type PaymentMethod,
  type PaymentUpdate,
  type Unsubscribe,
} from '@bitkit-ui/adapters';
import { resolveFiatRate } from '../../internal/amount.js';
import { resolveAdapter } from '../../internal/adapters.js';
import { BitkitElement } from '../../internal/base.js';
import { bigintConverter, listConverter, toBigint } from '../../internal/converters.js';
import { CountdownController } from '../../internal/countdown.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../amount-display/amount-display.js';
import '../button/button.js';
import '../copy-button/copy-button.js';
import '../dialog/dialog.js';
import '../network-badge/network-badge.js';
import '../payment-status/payment-status.js';
import '../qr-code/qr-code.js';
import '../skeleton/skeleton.js';
import '../tabs/tabs.js';

export type CheckoutState = 'idle' | 'creating' | 'awaiting' | 'paid' | 'expired' | 'error';
type View = 'unified' | 'lightning' | 'onchain';

interface WebLN {
  enable(): Promise<void>;
  sendPayment(pr: string): Promise<{ preimage: string }>;
}

const webln = (): WebLN | undefined => (globalThis as { webln?: WebLN }).webln;

/**
 * @summary Complete "pay with bitcoin" flow: creates a payment request through an adapter, shows
 * a unified QR (on-chain + Lightning) with method tabs, amount and fiat value, copy buttons,
 * expiry countdown, open-in-wallet link, one-click WebLN payment and live status updates.
 * Works inline or as a modal.
 * @tag bk-checkout
 * @slot header - Replace the default heading.
 * @slot success - Custom content for the paid screen.
 * @csspart base - Container.
 * @csspart header - Heading row.
 * @csspart amount - Amount block.
 * @csspart qr - QR code.
 * @csspart details - Copyable details.
 * @csspart actions - Wallet buttons.
 * @csspart status - Status block.
 * @fires bk-invoice-created - Detail: `{ invoice }`.
 * @fires bk-status-change - Detail: `PaymentUpdate`.
 * @fires bk-paid - Detail: `{ invoice, update }`.
 * @fires bk-expired - Detail: `{ invoice }`.
 * @fires bk-error - Detail: `{ error }`.
 * @fires bk-close - When the modal closes.
 */
export class BkCheckout extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .co {
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-4);
      }
      :host([mode='inline']) .co {
        padding: var(--bk-space-5);
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-lg);
        background: var(--bk-color-surface);
        box-shadow: var(--bk-shadow-md);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--bk-space-2);
      }
      h2 {
        margin: 0;
        font-size: var(--bk-font-size-lg);
        font-weight: var(--bk-font-weight-semibold);
      }
      .amount {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--bk-space-1);
        text-align: center;
      }
      .desc {
        margin: 0;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text-muted);
      }
      .qr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--bk-space-3);
      }
      .qr-wrap bk-qr-code {
        width: min(100%, 264px);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-2);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--bk-space-2);
        padding: var(--bk-space-2) var(--bk-space-2) var(--bk-space-2) var(--bk-space-3);
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-md);
        min-width: 0;
      }
      .row .k {
        flex: none;
        font-size: var(--bk-font-size-xs);
        font-weight: var(--bk-font-weight-semibold);
        color: var(--bk-color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        min-width: 5.5rem;
      }
      .row .v {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--bk-font-mono);
        font-size: var(--bk-font-size-sm);
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-2);
      }
      .meta {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--bk-space-2);
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text-muted);
        font-variant-numeric: tabular-nums;
      }
      .meta svg {
        width: 1rem;
        height: 1rem;
      }
      .soon {
        color: var(--bk-color-warning);
      }
      .demo {
        display: flex;
        gap: var(--bk-space-2);
        align-items: center;
        padding: var(--bk-space-2) var(--bk-space-3);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-info-bg);
        color: var(--bk-color-info);
        font-size: var(--bk-font-size-xs);
        font-weight: var(--bk-font-weight-medium);
      }
      .demo svg {
        width: 1rem;
        height: 1rem;
        flex: none;
      }
      .note {
        margin: 0;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-danger);
        text-align: center;
      }
      .center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--bk-space-3);
      }
      .skeleton-qr {
        width: min(100%, 264px);
        aspect-ratio: 1;
      }
      bk-skeleton[shape='rect'] {
        height: 100%;
      }
    `,
  ];

  static override properties = {
    adapter: {},
    amount: { converter: bigintConverter },
    fiatAmount: { type: String, attribute: 'fiat-amount' },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    fiatRate: { attribute: false },
    description: { type: String },
    orderId: { type: String, attribute: 'order-id' },
    methods: { converter: listConverter },
    mode: { type: String, reflect: true },
    open: { type: Boolean, reflect: true },
    invoice: { attribute: false },
    heading: { type: String },
    autoStart: { type: Boolean, attribute: 'auto-start' },
    webln: { type: Boolean },
    locale: { type: String },
    expirySeconds: { type: Number, attribute: 'expiry-seconds' },
    _state: { state: true },
    _invoice: { state: true },
    _update: { state: true },
    _error: { state: true },
    _view: { state: true },
    _weblnBusy: { state: true },
    _weblnError: { state: true },
  };

  /** A PaymentAdapter instance, or the name of a registered adapter (e.g. `mock`). */
  declare adapter: PaymentAdapter | string | undefined;
  /** Amount in sats. */
  declare amount: bigint | undefined;
  /** Fiat amount to charge (the adapter converts), e.g. "12.50". */
  declare fiatAmount: string | undefined;
  /** Currency for `fiat-amount`, and for the fiat estimate with `fiat-price`. */
  declare fiatCurrency: string | undefined;
  /** Price of 1 BTC for showing a fiat estimate. */
  declare fiatPrice: string | undefined;
  declare fiatRate: FiatRate | undefined;
  declare description: string | undefined;
  declare orderId: string | undefined;
  /** Offered methods. Default `lightning,onchain`. */
  declare methods: PaymentMethod[];
  /** `inline` (card in the page) or `modal`. */
  declare mode: 'inline' | 'modal';
  /** Modal open state. */
  declare open: boolean;
  /** Use an invoice created elsewhere (e.g. server-rendered) instead of calling the adapter. */
  declare invoice: Invoice | undefined;
  declare heading: string | undefined;
  /** Inline mode: create the payment request on connect. Default true. */
  declare autoStart: boolean;
  /** Offer one-click payment with a WebLN browser wallet when available. Default true. */
  declare webln: boolean;
  declare locale: string | undefined;
  declare expirySeconds: number | undefined;

  declare _state: CheckoutState;
  declare _invoice: Invoice | undefined;
  declare _update: PaymentUpdate | undefined;
  declare _error: string | undefined;
  declare _view: View;
  declare _weblnBusy: boolean;
  declare _weblnError: string | undefined;

  #unsub?: Unsubscribe;
  #abort?: AbortController;
  #countdown = new CountdownController(this, () => this.#onLocalExpiry());

  constructor() {
    super();
    this.methods = ['lightning', 'onchain'];
    this.mode = 'inline';
    this.open = false;
    this.autoStart = true;
    this.webln = true;
    this._state = 'idle';
    this._view = 'unified';
    this._weblnBusy = false;
  }

  /** Current checkout state. */
  get state(): CheckoutState {
    return this._state;
  }

  /** The active payment request. */
  get currentInvoice(): Invoice | undefined {
    return this._invoice;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.mode === 'inline' && this.autoStart && this._state === 'idle')
      void this.updateComplete.then(() => this.start());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardown();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.mode === 'modal') {
      if (
        this.open &&
        (this._state === 'idle' ||
          this._state === 'error' ||
          this._state === 'expired' ||
          this._state === 'paid')
      ) {
        void this.start();
      }
      if (!this.open && changed.get('open')) this.#teardown();
    }
    if (changed.has('invoice') && this.invoice && this.invoice !== this._invoice) void this.start();
  }

  #teardown() {
    this.#abort?.abort();
    this.#unsub?.();
    this.#unsub = undefined;
  }

  /** Create (or re-create) the payment request and start listening for updates. */
  async start(): Promise<void> {
    this.#teardown();
    this._update = undefined;
    this._error = undefined;
    this._weblnError = undefined;
    const adapter = resolveAdapter(this.adapter);
    let invoice = this.invoice;
    if (!invoice) {
      if (!adapter) {
        this.#fail('No payment adapter configured.');
        return;
      }
      const amountSats = toBigint(this.amount);
      if (amountSats === undefined && !(this.fiatAmount && this.fiatCurrency)) {
        this._state = 'idle';
        return;
      }
      const req: CreateInvoiceRequest = {
        amountSats,
        fiat:
          amountSats === undefined
            ? { amount: this.fiatAmount!, currency: this.fiatCurrency! }
            : undefined,
        description: this.description,
        orderId: this.orderId,
        methods: this.methods.length ? this.methods : undefined,
        expirySeconds: this.expirySeconds,
      };
      this._state = 'creating';
      this.#abort = new AbortController();
      try {
        invoice = await adapter.createInvoice(req, { signal: this.#abort.signal });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        this.#fail((e as Error).message || 'Could not create a payment request.');
        return;
      }
    }
    this._invoice = invoice;
    this._view =
      invoice.lightning && invoice.onchain
        ? 'unified'
        : invoice.lightning
          ? 'lightning'
          : 'onchain';
    this._state = 'awaiting';
    this.#countdown.deadline = invoice.expiresAt;
    this.emit('bk-invoice-created', { invoice });
    if (adapter) this.#unsub = adapter.subscribe(invoice.id, (u) => this.#onUpdate(u));
  }

  #fail(message: string) {
    this._state = 'error';
    this._error = message;
    this.emit('bk-error', { error: message });
  }

  #onUpdate(u: PaymentUpdate) {
    if (!this._invoice || u.invoiceId !== this._invoice.id) return;
    this._update = u;
    this.emit('bk-status-change', u);
    if (isPaidStatus(u.status)) {
      this._state = 'paid';
      this.#countdown.deadline = undefined;
      this.emit('bk-paid', { invoice: this._invoice, update: u });
    } else if (u.status === 'expired' || u.status === 'cancelled' || u.status === 'failed') {
      this._state = u.status === 'failed' ? 'error' : 'expired';
      if (u.status === 'failed') this._error = 'The payment failed.';
      this.#countdown.deadline = undefined;
      if (u.status !== 'failed') this.emit('bk-expired', { invoice: this._invoice });
    }
    if (isTerminalStatus(u.status)) {
      this.#unsub?.();
      this.#unsub = undefined;
    }
  }

  #onLocalExpiry() {
    // Stop showing a payable QR as soon as the deadline passes, even if the provider lags.
    const s = this._update?.status;
    if (this._state === 'awaiting' && (!s || s === 'pending')) {
      this._state = 'expired';
      this.emit('bk-expired', { invoice: this._invoice });
    }
  }

  /** Close the modal. */
  close(): void {
    this.open = false;
  }

  async #payWithWebln() {
    const w = webln();
    const pr = this._invoice?.lightning;
    if (!w || !pr) return;
    this._weblnBusy = true;
    this._weblnError = undefined;
    try {
      await w.enable();
      const res = await w.sendPayment(pr);
      this.emit('bk-webln-paid', { preimage: res?.preimage });
    } catch (e) {
      this._weblnError = (e as Error)?.message || 'The wallet did not complete the payment.';
    } finally {
      this._weblnBusy = false;
    }
  }

  get #rate(): FiatRate | undefined {
    return resolveFiatRate(
      this.fiatRate,
      this.fiatPrice ? this.fiatCurrency : undefined,
      this.fiatPrice,
      this.config.fiatRate,
    );
  }

  #qrValue(inv: Invoice): string {
    const ln = inv.lightning;
    const addr = inv.onchain?.address;
    if (this._view === 'lightning' && ln) return ln.toUpperCase();
    if (this._view === 'onchain' && addr)
      return buildBip21({ address: addr, amountSats: inv.amountSats, uppercase: true });
    return buildBip21({
      address: addr,
      amountSats: addr ? inv.amountSats : undefined,
      lightning: ln,
      uppercase: true,
    });
  }

  #walletLink(inv: Invoice): string {
    if (this._view === 'lightning' && inv.lightning) return `lightning:${inv.lightning}`;
    if (this._view === 'onchain' && inv.onchain)
      return inv.onchain.uri ?? `bitcoin:${inv.onchain.address}`;
    return buildBip21({
      address: inv.onchain?.address,
      amountSats: inv.onchain ? inv.amountSats : undefined,
      lightning: inv.lightning,
    });
  }

  #row(label: string, value: string, copyLabel: string) {
    return html`<div class="row">
      <span class="k">${label}</span><span class="v" title=${value}>${value}</span>
      <bk-copy-button size="sm" .value=${value} label=${copyLabel}></bk-copy-button>
    </div>`;
  }

  #renderAwaiting(inv: Invoice) {
    const views: [View, string][] = [];
    if (inv.lightning && inv.onchain) views.push(['unified', 'Any wallet']);
    if (inv.lightning) views.push(['lightning', 'Lightning']);
    if (inv.onchain) views.push(['onchain', 'On-chain']);
    const left = this.#countdown.remaining;
    const btc = fromMsat(inv.amountSats * MSAT_PER_SAT, 'btc', { maxFractionDigits: 8 });
    const panel = html`<div class="qr-wrap">
      <bk-qr-code
        part="qr"
        .value=${this.#qrValue(inv)}
        size="264"
        label=${this._view === 'onchain' ? 'on-chain payment' : this._view === 'lightning' ? 'Lightning invoice' : 'payment request'}
      ></bk-qr-code>
    </div>`;
    const details: TemplateResult[] = [];
    if ((this._view === 'unified' || this._view === 'lightning') && inv.lightning)
      details.push(this.#row('Invoice', inv.lightning, 'Copy Lightning invoice'));
    if ((this._view === 'unified' || this._view === 'onchain') && inv.onchain) {
      details.push(this.#row('Address', inv.onchain.address, 'Copy bitcoin address'));
      details.push(this.#row('Amount', `${btc} BTC`, 'Copy amount'));
    }
    const canWebln = this.webln && !!inv.lightning && !!webln() && this._view !== 'onchain';
    return html`
      ${
        inv.mock
          ? html`<div class="demo" role="note">
              ${iconSvg('info')}<span
                >Demo payment on ${inv.network}. Do not send real bitcoin.</span
              >
            </div>`
          : nothing
      }
      ${
        views.length > 1
          ? html`<bk-tabs
              label="Payment method"
              .value=${this._view}
              @bk-change=${(e: CustomEvent<{ value: View }>) => (this._view = e.detail.value)}
            >
              ${views.map(([v, label]) => html`<div slot=${v} label=${label}>${v === this._view ? panel : nothing}</div>`)}
            </bk-tabs>`
          : panel
      }
      <div class="rows" part="details">${details}</div>
      <div class="actions" part="actions">
        ${
          canWebln
            ? html`<bk-button block ?loading=${this._weblnBusy} @click=${this.#payWithWebln}
                ><span slot="prefix">${iconSvg('lightning')}</span>Pay with browser
                wallet</bk-button
              >`
            : nothing
        }
        <bk-button block variant=${canWebln ? 'secondary' : 'primary'} href=${this.#walletLink(inv)}
          ><span slot="prefix">${iconSvg('wallet')}</span>Open in wallet</bk-button
        >
        ${this._weblnError ? html`<p class="note" role="alert">${this._weblnError}</p>` : nothing}
      </div>
      ${
        left !== undefined
          ? html`<div class="meta">
              ${iconSvg('clock')}<span class=${left < 60 ? 'soon' : ''} aria-hidden="true"
                >Expires in ${formatCountdown(left)}</span
              >
              <span class="sr-only"
                >Expires in
                ${countdownForScreenReader(left > 60 ? Math.floor(left / 60) * 60 : left)}</span
              >
            </div>`
          : nothing
      }
      <bk-payment-status
        part="status"
        status=${this._update?.status ?? 'pending'}
        .confirmations=${this._update?.confirmations}
        .requiredConfirmations=${this._update?.requiredConfirmations}
        .amountReceived=${this._update?.amountReceivedSats}
        .amountDue=${inv.amountSats}
        method=${this._update?.method ?? nothing}
      ></bk-payment-status>
    `;
  }

  #renderBody() {
    const inv = this._invoice;
    switch (this._state) {
      case 'creating':
        return html`<div class="center" aria-busy="true">
          <div class="skeleton-qr"><bk-skeleton shape="rect"></bk-skeleton></div>
          <bk-skeleton width="80%"></bk-skeleton>
          <span class="sr-only" role="status">Creating payment request…</span>
        </div>`;
      case 'awaiting':
        return inv ? this.#renderAwaiting(inv) : nothing;
      case 'paid':
        return html`<slot name="success"
            ><bk-payment-status
              size="large"
              status=${this._update?.status ?? 'paid'}
              .amountReceived=${this._update?.amountReceivedSats}
              .amountDue=${inv?.amountSats}
            ></bk-payment-status
          ></slot>
          ${this.mode === 'modal' ? html`<bk-button block @click=${() => this.close()}>Done</bk-button>` : nothing}`;
      case 'expired':
        return html`<bk-payment-status
            size="large"
            status=${this._update?.status === 'cancelled' ? 'cancelled' : 'expired'}
          ></bk-payment-status>
          <bk-button block @click=${() => this.start()}>Create new payment request</bk-button>`;
      case 'error':
        return html`<bk-payment-status
            size="large"
            status="failed"
            message=${this._error ?? 'Something went wrong.'}
          ></bk-payment-status>
          <bk-button block variant="secondary" @click=${() => this.start()}>Try again</bk-button>`;
      default:
        return html`<p class="desc" style="text-align:center">
          Set an amount to create a payment request.
        </p>`;
    }
  }

  #renderContent() {
    const inv = this._invoice;
    const sats = inv?.amountSats ?? toBigint(this.amount);
    const showAmount = this._state !== 'paid' && sats !== undefined;
    return html`<div class="co" part="base">
      ${
        this.mode === 'inline'
          ? html`<div class="head" part="header">
              <slot name="header"><h2>${this.heading ?? 'Pay with bitcoin'}</h2></slot>
              ${inv ? html`<bk-network-badge network=${inv.network} hide-mainnet></bk-network-badge>` : nothing}
            </div>`
          : nothing
      }
      ${
        showAmount
          ? html`<div class="amount" part="amount">
              <bk-amount-display
                .amount=${sats}
                size="xl"
                toggle
                ?show-fiat=${!!this.#rate}
                .fiatRate=${this.#rate}
                locale=${this.locale ?? nothing}
              ></bk-amount-display>
              ${inv?.fiat ? html`<p class="desc">${inv.fiat.amount} ${inv.fiat.currency}</p>` : nothing}
              ${(inv?.description ?? this.description) ? html`<p class="desc">${inv?.description ?? this.description}</p>` : nothing}
            </div>`
          : nothing
      }
      ${this.#renderBody()}
    </div>`;
  }

  override render() {
    if (this.mode === 'modal') {
      return html`<bk-dialog
        label=${this.heading ?? 'Pay with bitcoin'}
        ?open=${this.open}
        @bk-close=${(e: Event) => {
          e.stopPropagation();
          this.open = false;
          this.emit('bk-close');
        }}
        >${this.open ? this.#renderContent() : nothing}</bk-dialog
      >`;
    }
    return this.#renderContent();
  }
}

define('bk-checkout', BkCheckout);

declare global {
  interface HTMLElementTagNameMap {
    'bk-checkout': BkCheckout;
  }
}
