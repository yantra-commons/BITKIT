import { css, html, nothing, type PropertyValues } from 'lit';
import {
  countdownForScreenReader,
  decodeBolt11,
  formatCountdown,
  toErrorInfo,
  truncateMiddle,
  type Bolt11Invoice,
  type ErrorInfo,
} from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { CountdownController } from '../../internal/countdown.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../amount-display/amount-display.js';
import '../copy-button/copy-button.js';
import '../network-badge/network-badge.js';
import '../qr-code/qr-code.js';

/**
 * @summary Decodes a BOLT11 Lightning invoice and shows amount, description, expiry countdown,
 * network and payment hash. Signatures are not verified (display only).
 * @tag bk-invoice-display
 * @csspart base - Container.
 * @csspart amount - Amount.
 * @csspart details - Detail list.
 * @csspart qr - QR code.
 * @fires bk-expired - When the countdown reaches zero.
 */
export class BkInvoiceDisplay extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-4);
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--bk-space-3);
      }
      .any {
        font-size: var(--bk-font-size-xl);
        font-weight: var(--bk-font-weight-semibold);
      }
      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--bk-space-2) var(--bk-space-4);
        margin: 0;
        font-size: var(--bk-font-size-sm);
      }
      dt {
        color: var(--bk-color-text-muted);
      }
      dd {
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--bk-space-1);
        min-width: 0;
        word-break: break-word;
      }
      .mono {
        font-family: var(--bk-font-mono);
      }
      .expired {
        color: var(--bk-color-danger);
        font-weight: var(--bk-font-weight-semibold);
      }
      .soon {
        color: var(--bk-color-warning);
      }
      .qr {
        align-self: center;
      }
      .error {
        display: flex;
        gap: var(--bk-space-2);
        padding: var(--bk-space-3);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-danger-bg);
        color: var(--bk-color-danger);
        font-size: var(--bk-font-size-sm);
      }
      .error svg {
        width: 1.2rem;
        height: 1.2rem;
        flex: none;
      }
      bk-copy-button {
        --bk-control-height-md: 1.75rem;
      }
    `,
  ];

  static override properties = {
    invoice: { type: String },
    qr: { type: Boolean },
    locale: { type: String },
    showDetails: { type: Boolean, attribute: 'show-details' },
  };

  /** BOLT11 payment request (with or without `lightning:`). */
  declare invoice: string;
  /** Show a QR code of the invoice. */
  declare qr: boolean;
  declare locale: string | undefined;
  /** Show payment hash and payee. Default true. */
  declare showDetails: boolean;

  #decoded?: Bolt11Invoice;
  #error?: ErrorInfo;
  #countdown = new CountdownController(this, () => this.emit('bk-expired'));

  constructor() {
    super();
    this.invoice = '';
    this.qr = false;
    this.showDetails = true;
  }

  /** The decoded invoice (undefined when empty or invalid). */
  get decoded(): Bolt11Invoice | undefined {
    return this.#decoded;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('invoice')) {
      this.#decoded = undefined;
      this.#error = undefined;
      if (this.invoice.trim()) {
        try {
          this.#decoded = decodeBolt11(this.invoice);
        } catch (e) {
          this.#error = toErrorInfo(e);
        }
      }
      this.#countdown.deadline = this.#decoded ? this.#decoded.expiresAt * 1000 : undefined;
    }
  }

  override render() {
    if (this.#error) {
      return html`<div class="error" part="base" role="alert">
        ${iconSvg('alert-circle')}<span>${this.#error.message}</span>
      </div>`;
    }
    const inv = this.#decoded;
    if (!inv) return html`<div part="base"></div>`;
    const left = this.#countdown.remaining ?? 0;
    const expired = left <= 0;
    return html`<div class="card" part="base">
      <div class="top">
        <div part="amount">
          ${
            inv.amountMsat === null
              ? html`<span class="any">Any amount</span>`
              : html`<bk-amount-display
                  .msat=${inv.amountMsat}
                  size="xl"
                  locale=${this.locale ?? nothing}
                ></bk-amount-display>`
          }
        </div>
        <bk-network-badge network=${inv.network} hide-mainnet></bk-network-badge>
      </div>
      <dl part="details">
        <dt>Description</dt>
        <dd>
          ${
            inv.description !== undefined && inv.description !== ''
              ? inv.description
              : inv.descriptionHash
                ? html`<span class="mono" title=${inv.descriptionHash}
                    >Hash ${truncateMiddle(inv.descriptionHash, { start: 6, end: 6 })}</span
                  >`
                : html`<span style="color:var(--bk-color-text-muted)">None</span>`
          }
        </dd>
        <dt>Expires</dt>
        <dd>
          ${
            expired
              ? html`<span class="expired">Expired</span>`
              : html`<span class=${left < 60 ? 'soon' : ''} aria-hidden="true"
                    >in ${formatCountdown(left)}</span
                  ><span class="sr-only"
                    >in ${countdownForScreenReader(Math.floor(left / 60) * 60 || left)}</span
                  >`
          }
        </dd>
        ${
          this.showDetails
            ? html`<dt>Payment hash</dt>
                <dd>
                  <span class="mono" title=${inv.paymentHash}
                    >${truncateMiddle(inv.paymentHash, { start: 8, end: 8 })}</span
                  >
                  <bk-copy-button
                    size="sm"
                    .value=${inv.paymentHash}
                    label="Copy payment hash"
                  ></bk-copy-button>
                </dd>
                ${
                  inv.payeeNodeKey
                    ? html`<dt>Recipient node</dt>
                        <dd>
                          <span class="mono" title=${inv.payeeNodeKey}
                            >${truncateMiddle(inv.payeeNodeKey, { start: 8, end: 8 })}</span
                          >
                        </dd>`
                    : nothing
                }`
            : nothing
        }
      </dl>
      ${
        this.qr && !expired
          ? html`<bk-qr-code
              class="qr"
              part="qr"
              .value=${inv.paymentRequest.toUpperCase()}
              label="Lightning invoice"
              size="220"
            ></bk-qr-code>`
          : nothing
      }
    </div>`;
  }
}

define('bk-invoice-display', BkInvoiceDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'bk-invoice-display': BkInvoiceDisplay;
  }
}
