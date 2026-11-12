import { css, html, nothing, type PropertyValues } from 'lit';
import {
  countdownForScreenReader,
  decodeBolt11,
  formatCountdown,
  toErrorInfo,
  truncateMiddle,
  type Bolt11Invoice,
  type ErrorInfo,
} from '@orange-ui/core';
import { OrangeElement } from '../../internal/base.js';
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
 * @tag ou-invoice-display
 * @csspart base - Container.
 * @csspart amount - Amount.
 * @csspart details - Detail list.
 * @csspart qr - QR code.
 * @fires ou-expired - When the countdown reaches zero.
 */
export class OuInvoiceDisplay extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-4);
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--ou-space-3);
      }
      .any {
        font-size: var(--ou-font-size-xl);
        font-weight: var(--ou-font-weight-semibold);
      }
      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--ou-space-2) var(--ou-space-4);
        margin: 0;
        font-size: var(--ou-font-size-sm);
      }
      dt {
        color: var(--ou-color-text-muted);
      }
      dd {
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--ou-space-1);
        min-width: 0;
        word-break: break-word;
      }
      .mono {
        font-family: var(--ou-font-mono);
      }
      .expired {
        color: var(--ou-color-danger);
        font-weight: var(--ou-font-weight-semibold);
      }
      .soon {
        color: var(--ou-color-warning);
      }
      .qr {
        align-self: center;
      }
      .error {
        display: flex;
        gap: var(--ou-space-2);
        padding: var(--ou-space-3);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-danger-bg);
        color: var(--ou-color-danger);
        font-size: var(--ou-font-size-sm);
      }
      .error svg {
        width: 1.2rem;
        height: 1.2rem;
        flex: none;
      }
      ou-copy-button {
        --ou-control-height-md: 1.75rem;
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
  #countdown = new CountdownController(this, () => this.emit('ou-expired'));

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
              : html`<ou-amount-display
                  .msat=${inv.amountMsat}
                  size="xl"
                  locale=${this.locale ?? nothing}
                ></ou-amount-display>`
          }
        </div>
        <ou-network-badge network=${inv.network} hide-mainnet></ou-network-badge>
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
                : html`<span style="color:var(--ou-color-text-muted)">None</span>`
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
                  <ou-copy-button
                    size="sm"
                    .value=${inv.paymentHash}
                    label="Copy payment hash"
                  ></ou-copy-button>
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
          ? html`<ou-qr-code
              class="qr"
              part="qr"
              .value=${inv.paymentRequest.toUpperCase()}
              label="Lightning invoice"
              size="220"
            ></ou-qr-code>`
          : nothing
      }
    </div>`;
  }
}

define('ou-invoice-display', OuInvoiceDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'ou-invoice-display': OuInvoiceDisplay;
  }
}
