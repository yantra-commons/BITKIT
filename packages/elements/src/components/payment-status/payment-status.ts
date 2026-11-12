import { css, html, nothing } from 'lit';
import { formatAmount, MSAT_PER_SAT } from '@orange-ui/core';
import type { PaymentStatus } from '@orange-ui/adapters';
import { OrangeElement } from '../../internal/base.js';
import { bigintConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg, type IconName } from '../icon/icon.js';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusCopy {
  title: string;
  body: string;
  icon: IconName;
  tone: Tone;
}

/**
 * @summary Shows where a payment is in its lifecycle: pending, detected, confirming (n/N), paid,
 * underpaid/overpaid, expired, failed or cancelled. Announced to screen readers; animations
 * respect reduced motion.
 * @tag ou-payment-status
 * @csspart base - Container.
 * @csspart icon - Status icon.
 * @csspart title - Headline.
 * @csspart body - Explanation.
 * @csspart progress - Confirmation progress bar.
 */
export class OuPaymentStatus extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .s {
        display: flex;
        align-items: flex-start;
        gap: var(--ou-space-3);
        padding: var(--ou-space-3) var(--ou-space-4);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-surface-2);
      }
      .large {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--ou-space-6) var(--ou-space-4);
        background: transparent;
      }
      .icon {
        flex: none;
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: var(--ou-color-surface-3);
        color: var(--ou-color-text-muted);
      }
      .large .icon {
        width: 4rem;
        height: 4rem;
      }
      .icon svg {
        width: 60%;
        height: 60%;
      }
      .success .icon {
        background: var(--ou-color-success-bg);
        color: var(--ou-color-success);
        animation: pop var(--ou-duration-slow) var(--ou-easing-standard);
      }
      .warning .icon {
        background: var(--ou-color-warning-bg);
        color: var(--ou-color-warning);
      }
      .danger .icon {
        background: var(--ou-color-danger-bg);
        color: var(--ou-color-danger);
      }
      .info .icon {
        background: var(--ou-color-info-bg);
        color: var(--ou-color-info);
      }
      .neutral .icon {
        animation: pulse 2s ease-in-out infinite;
      }
      .title {
        margin: 0;
        font-weight: var(--ou-font-weight-semibold);
        font-size: var(--ou-font-size-md);
      }
      .large .title {
        font-size: var(--ou-font-size-xl);
      }
      .body {
        margin: 2px 0 0;
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-text-muted);
      }
      .bar {
        height: 6px;
        margin-top: var(--ou-space-2);
        border-radius: var(--ou-radius-full);
        background: var(--ou-color-surface-3);
        overflow: hidden;
      }
      .bar > span {
        display: block;
        height: 100%;
        background: var(--ou-color-accent);
        transition: width var(--ou-duration-slow) var(--ou-easing-standard);
      }
      .text {
        min-width: 0;
        flex: 1;
      }
      .large .text {
        width: 100%;
        max-width: 22rem;
      }
      @keyframes pop {
        0% {
          transform: scale(0.6);
          opacity: 0;
        }
        70% {
          transform: scale(1.08);
        }
      }
      @keyframes pulse {
        50% {
          opacity: 0.55;
        }
      }
    `,
  ];

  static override properties = {
    status: { type: String, reflect: true },
    confirmations: { type: Number },
    requiredConfirmations: { type: Number, attribute: 'required-confirmations' },
    amountReceived: { converter: bigintConverter, attribute: 'amount-received' },
    amountDue: { converter: bigintConverter, attribute: 'amount-due' },
    method: { type: String },
    size: { type: String },
    heading: { type: String },
    message: { type: String },
    locale: { type: String },
  };

  declare status: PaymentStatus;
  declare confirmations: number | undefined;
  declare requiredConfirmations: number | undefined;
  /** Sats received so far (under/overpayment messages). */
  declare amountReceived: bigint | undefined;
  /** Sats requested. */
  declare amountDue: bigint | undefined;
  declare method: 'lightning' | 'onchain' | undefined;
  /** `compact` (inline row) or `large` (centered, for success screens). */
  declare size: 'compact' | 'large';
  /** Override the headline. */
  declare heading: string | undefined;
  /** Override the explanation. */
  declare message: string | undefined;
  declare locale: string | undefined;

  constructor() {
    super();
    this.status = 'pending';
    this.size = 'compact';
  }

  #fmt(sats: bigint | undefined) {
    return sats === undefined
      ? ''
      : formatAmount(sats * MSAT_PER_SAT, { unit: 'sats', locale: this.localeFor(this.locale) })
          .text;
  }

  #copy(): StatusCopy {
    const conf = this.confirmations ?? 0;
    const req = this.requiredConfirmations ?? 1;
    const received = toBigint(this.amountReceived);
    const due = toBigint(this.amountDue);
    switch (this.status) {
      case 'detected':
        return {
          title: 'Payment detected',
          body:
            this.method === 'lightning'
              ? 'Finalizing your payment…'
              : 'Waiting for the first confirmation. You can safely close this page.',
          icon: 'check',
          tone: 'info',
        };
      case 'confirming':
        return {
          title: 'Confirming payment',
          body: `${conf} of ${req} confirmations`,
          icon: `confirmations${Math.min(6, Math.max(0, conf))}` as IconName,
          tone: 'info',
        };
      case 'paid':
        return {
          title: 'Payment received',
          body: 'Thank you! Your payment is complete.',
          icon: 'check',
          tone: 'success',
        };
      case 'overpaid':
        return {
          title: 'Payment received',
          body:
            received !== undefined && due !== undefined
              ? `You sent ${this.#fmt(received - due)} more than requested. Contact the merchant about a refund.`
              : 'You sent more than requested. Contact the merchant about a refund.',
          icon: 'check',
          tone: 'success',
        };
      case 'underpaid':
        return {
          title: 'Partial payment received',
          body:
            received !== undefined && due !== undefined
              ? `Received ${this.#fmt(received)} of ${this.#fmt(due)}. Send the remaining ${this.#fmt(due - received)} to complete the payment.`
              : 'The amount received is less than requested.',
          icon: 'alert-circle',
          tone: 'warning',
        };
      case 'expired':
        return {
          title: 'Payment request expired',
          body: "Don't send funds to it. Create a new request to try again.",
          icon: 'clock',
          tone: 'danger',
        };
      case 'failed':
        return {
          title: 'Payment failed',
          body: 'The payment could not be completed.',
          icon: 'alert-circle',
          tone: 'danger',
        };
      case 'cancelled':
        return {
          title: 'Payment cancelled',
          body: 'This payment request is no longer valid.',
          icon: 'cross',
          tone: 'neutral',
        };
      default:
        return {
          title: 'Waiting for payment',
          body: 'Scan the QR code with your wallet or copy the payment details.',
          icon: 'clock',
          tone: 'neutral',
        };
    }
  }

  override render() {
    const c = this.#copy();
    const confirming =
      this.status === 'confirming' ||
      (this.status === 'detected' && this.method !== 'lightning' && this.requiredConfirmations);
    const pct = Math.min(
      100,
      Math.round(((this.confirmations ?? 0) / (this.requiredConfirmations || 1)) * 100),
    );
    return html`<div
      class="s ${c.tone} ${this.size}"
      part="base"
      role=${this.status === 'failed' ? 'alert' : 'status'}
      aria-live=${this.status === 'failed' ? 'assertive' : 'polite'}
    >
      <span class="icon" part="icon" aria-hidden="true">${iconSvg(c.icon)}</span>
      <div class="text">
        <p class="title" part="title">${this.heading ?? c.title}</p>
        <p class="body" part="body">${this.message ?? c.body}</p>
        ${
          confirming
            ? html`<div
                class="bar"
                part="progress"
                role="progressbar"
                aria-label="Confirmations"
                aria-valuemin="0"
                aria-valuemax=${this.requiredConfirmations ?? 1}
                aria-valuenow=${this.confirmations ?? 0}
              >
                <span style="width:${pct}%"></span>
              </div>`
            : nothing
        }
      </div>
    </div>`;
  }
}

define('ou-payment-status', OuPaymentStatus);

declare global {
  interface HTMLElementTagNameMap {
    'ou-payment-status': OuPaymentStatus;
  }
}
