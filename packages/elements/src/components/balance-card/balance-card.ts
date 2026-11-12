import { css, html, nothing } from 'lit';
import { formatAmount, MSAT_PER_SAT, type DisplayUnit, type FiatRate } from '@orange-ui/core';
import { resolveFiatRate } from '../../internal/amount.js';
import { OrangeElement } from '../../internal/base.js';
import { bigintConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import '../amount-display/amount-display.js';
import '../network-badge/network-badge.js';

/**
 * @summary Wallet balance with fiat value, pending amount, privacy toggle and an actions slot
 * for Send / Receive buttons.
 * @tag ou-balance-card
 * @slot actions - Buttons under the balance.
 * @slot header - Replace the label row.
 * @csspart base - Card.
 * @csspart amount - The ou-amount-display.
 * @csspart pending - Pending line.
 */
export class OuBalanceCard extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-3);
        padding: var(--ou-space-5);
        border: 1px solid var(--ou-color-border);
        border-radius: var(--ou-radius-lg);
        background: var(--ou-color-surface);
        box-shadow: var(--ou-shadow-sm);
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--ou-space-2);
      }
      .label {
        margin: 0;
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-medium);
        color: var(--ou-color-text-muted);
      }
      .pending {
        margin: 0;
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-text-muted);
      }
      ::slotted([slot='actions']) {
        display: flex;
        gap: var(--ou-space-2);
      }
    `,
  ];

  static override properties = {
    balance: { converter: bigintConverter },
    pending: { converter: bigintConverter },
    label: { type: String },
    unit: { type: String },
    network: { type: String },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    fiatRate: { attribute: false },
    privacy: { type: Boolean, reflect: true },
    loading: { type: Boolean },
    locale: { type: String },
  };

  /** Confirmed balance in sats. */
  declare balance: bigint | undefined;
  /** Unconfirmed incoming(+)/outgoing(−) sats. */
  declare pending: bigint | undefined;
  declare label: string;
  declare unit: DisplayUnit | undefined;
  declare network: string | undefined;
  declare fiatCurrency: string | undefined;
  declare fiatPrice: string | undefined;
  declare fiatRate: FiatRate | undefined;
  declare privacy: boolean;
  declare loading: boolean;
  declare locale: string | undefined;

  constructor() {
    super();
    this.label = 'Balance';
    this.privacy = false;
    this.loading = false;
  }

  override render() {
    const rate = resolveFiatRate(
      this.fiatRate,
      this.fiatCurrency,
      this.fiatPrice,
      this.config.fiatRate,
    );
    const pending = toBigint(this.pending);
    return html`<section class="card" part="base" aria-label=${this.label}>
      <div class="row">
        <slot name="header"><p class="label">${this.label}</p></slot>
        ${this.network ? html`<ou-network-badge network=${this.network} hide-mainnet></ou-network-badge>` : nothing}
      </div>
      <ou-amount-display
        part="amount"
        size="xl"
        .amount=${toBigint(this.balance)}
        .unit=${this.unit}
        .fiatRate=${rate}
        ?show-fiat=${!!rate}
        toggle
        privacy-toggle
        ?privacy=${this.privacy}
        ?loading=${this.loading}
        locale=${this.locale ?? nothing}
        @ou-privacy-change=${(e: CustomEvent<{ hidden: boolean }>) => (this.privacy = e.detail.hidden)}
      ></ou-amount-display>
      ${
        pending && !this.privacy && !this.loading
          ? html`<p class="pending" part="pending">
              ${pending > 0n ? 'Incoming' : 'Outgoing'}:
              ${formatAmount((pending < 0n ? -pending : pending) * MSAT_PER_SAT, { unit: 'sats', locale: this.localeFor(this.locale) }).text}
              (unconfirmed)
            </p>`
          : nothing
      }
      <slot name="actions"></slot>
    </section>`;
  }
}

define('ou-balance-card', OuBalanceCard);

declare global {
  interface HTMLElementTagNameMap {
    'ou-balance-card': OuBalanceCard;
  }
}
