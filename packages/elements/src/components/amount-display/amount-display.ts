import { css, html, nothing } from 'lit';
import {
  formatAmount,
  type DisplayUnit,
  type FiatRate,
  type FormattedAmount,
} from '@orange-ui/core';
import { resolveFiatRate, resolveMsat } from '../../internal/amount.js';
import { OrangeElement } from '../../internal/base.js';
import { bigintConverter } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../skeleton/skeleton.js';

/**
 * @summary Displays a bitcoin amount in sats, BTC or fiat. Optional unit toggle, fiat secondary
 * line and privacy mode. All math is exact (bigint).
 * @tag ou-amount-display
 * @csspart base - Wrapper.
 * @csspart value - The formatted amount (number + unit).
 * @csspart number - The number.
 * @csspart unit - The unit label.
 * @csspart fiat - Secondary fiat line.
 * @csspart privacy-toggle - Show/hide button.
 * @fires ou-unit-change - When the user toggles the unit. Detail: `{ unit }`.
 * @fires ou-privacy-change - When the privacy toggle is used. Detail: `{ hidden: boolean }`.
 */
export class OuAmountDisplay extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
        font-variant-numeric: tabular-nums;
      }
      .wrap {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
      }
      .row {
        display: inline-flex;
        align-items: center;
        gap: var(--ou-space-2);
      }
      .value {
        display: inline-flex;
        align-items: baseline;
        gap: 0.3em;
        font-weight: var(--ou-font-weight-semibold);
        letter-spacing: -0.01em;
        white-space: nowrap;
      }
      .unit {
        font-weight: var(--ou-font-weight-medium);
        color: var(--ou-color-text-muted);
        font-size: 0.8em;
      }
      .prefix .unit {
        font-size: 1em;
        color: inherit;
        margin-right: -0.25em;
      }
      .sm {
        font-size: var(--ou-font-size-sm);
      }
      .md {
        font-size: var(--ou-font-size-md);
      }
      .lg {
        font-size: var(--ou-font-size-xl);
      }
      .xl {
        font-size: var(--ou-font-size-2xl);
        line-height: var(--ou-line-height-tight);
      }
      .incoming .number {
        color: var(--ou-color-success);
      }
      .fiat {
        font-size: 0.75em;
        color: var(--ou-color-text-muted);
        font-weight: var(--ou-font-weight-regular);
      }
      .xl .fiat,
      .lg .fiat {
        font-size: var(--ou-font-size-md);
      }
      button.toggle {
        all: unset;
        cursor: pointer;
        border-radius: var(--ou-radius-sm);
      }
      button.toggle:hover .value {
        text-decoration: underline dotted;
        text-underline-offset: 4px;
      }
      button.toggle:focus-visible {
        box-shadow: var(--ou-focus-ring);
      }
      .eye {
        display: inline-grid;
        place-items: center;
        width: 1.75em;
        height: 1.75em;
        padding: 0;
        border: 0;
        border-radius: var(--ou-radius-sm);
        background: transparent;
        color: var(--ou-color-text-muted);
        cursor: pointer;
        font-size: var(--ou-font-size-md);
      }
      .eye:hover {
        background: var(--ou-color-surface-2);
      }
      .eye svg {
        width: 1.2em;
        height: 1.2em;
      }
      .hidden-dots {
        letter-spacing: 0.1em;
      }
    `,
  ];

  static override properties = {
    amount: { converter: bigintConverter },
    msat: { converter: bigintConverter },
    unit: { type: String, reflect: true },
    units: { type: Array },
    fiatRate: { attribute: false },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    showFiat: { type: Boolean, attribute: 'show-fiat' },
    toggle: { type: Boolean },
    privacy: { type: Boolean, reflect: true },
    privacyToggle: { type: Boolean, attribute: 'privacy-toggle' },
    locale: { type: String },
    size: { type: String },
    signDisplay: { type: String, attribute: 'sign-display' },
    direction: { type: String },
    btcStyle: { type: String, attribute: 'btc-style' },
    loading: { type: Boolean },
  };

  /** Amount in sats. */
  declare amount: bigint | undefined;
  /** Amount in millisats (takes precedence over `amount`). */
  declare msat: bigint | undefined;
  /** Display unit; defaults to the global config unit (`sats`). */
  declare unit: DisplayUnit | undefined;
  /** Units cycled by the toggle. Default sats → BTC (→ fiat when a rate is set). */
  declare units: DisplayUnit[] | undefined;
  /** Fiat rate object (property only). */
  declare fiatRate: FiatRate | undefined;
  /** Fiat currency code (attribute alternative to `fiatRate`). */
  declare fiatCurrency: string | undefined;
  /** Price of 1 BTC in `fiat-currency`. */
  declare fiatPrice: string | undefined;
  /** Show a secondary fiat line. */
  declare showFiat: boolean;
  /** Clicking the amount cycles units. */
  declare toggle: boolean;
  /** Hide the amount (privacy mode). */
  declare privacy: boolean;
  /** Show an eye button to toggle privacy. */
  declare privacyToggle: boolean;
  declare locale: string | undefined;
  declare size: 'sm' | 'md' | 'lg' | 'xl';
  declare signDisplay: 'auto' | 'always' | 'never' | undefined;
  /** `incoming` colors the amount as received. */
  declare direction: 'incoming' | 'outgoing' | undefined;
  /** `code` → "0.5 BTC", `symbol` → "₿0.5". */
  declare btcStyle: 'code' | 'symbol' | undefined;
  /** Show a loading skeleton. */
  declare loading: boolean;

  constructor() {
    super();
    this.showFiat = false;
    this.toggle = false;
    this.privacy = false;
    this.privacyToggle = false;
    this.size = 'md';
    this.loading = false;
  }

  get #rate(): FiatRate | undefined {
    return resolveFiatRate(this.fiatRate, this.fiatCurrency, this.fiatPrice, this.config.fiatRate);
  }

  get #units(): DisplayUnit[] {
    return this.units ?? (this.#rate ? ['sats', 'btc', 'fiat'] : ['sats', 'btc']);
  }

  /** Formatted result for the current state (undefined when no amount). */
  get formatted(): FormattedAmount | undefined {
    const msat = resolveMsat(this.amount, this.msat);
    if (msat === undefined) return undefined;
    const unit = this.unit ?? this.config.unit;
    const rate = this.#rate;
    return formatAmount(msat, {
      unit: unit === 'fiat' && !rate ? 'sats' : unit,
      fiatRate: rate,
      locale: this.localeFor(this.locale),
      signDisplay: this.signDisplay,
      btcStyle: this.btcStyle,
    });
  }

  #cycle() {
    const units = this.#units;
    const current = this.formatted?.resolvedUnit ?? 'sats';
    const i = units.indexOf(current as DisplayUnit);
    this.unit = units[(i + 1) % units.length];
    this.emit('ou-unit-change', { unit: this.unit });
  }

  #togglePrivacy() {
    this.privacy = !this.privacy;
    this.emit('ou-privacy-change', { hidden: this.privacy });
  }

  #renderValue(f: FormattedAmount) {
    if (this.privacy) {
      return html`<span class="value" part="value" aria-hidden="true"
          ><span class="hidden-dots">•••••</span></span
        ><span class="sr-only">${this.t('amountHidden')}</span>`;
    }
    const prefix = f.unitPosition === 'prefix' && f.resolvedUnit !== 'fiat';
    const body =
      f.resolvedUnit === 'fiat'
        ? html`<span class="number" part="number">${f.text}</span>`
        : prefix
          ? html`<span class="unit" part="unit">${f.unit}</span
              ><span class="number" part="number">${f.number}</span>`
          : html`<span class="number" part="number">${f.number}</span>
              <span class="unit" part="unit">${f.unit}</span>`;
    return html`<span class="value ${prefix ? 'prefix' : ''}" part="value" aria-hidden="true"
        >${body}</span
      ><span class="sr-only">${f.srText}</span>`;
  }

  #renderFiat() {
    const rate = this.#rate;
    const msat = resolveMsat(this.amount, this.msat);
    if (!this.showFiat || !rate || msat === undefined || this.privacy) return nothing;
    const f = this.formatted;
    if (f?.resolvedUnit === 'fiat') {
      const sats = formatAmount(msat, { unit: 'sats', locale: this.localeFor(this.locale) });
      return html`<span class="fiat" part="fiat">${sats.text}</span>`;
    }
    const fiat = formatAmount(msat, {
      unit: 'fiat',
      fiatRate: rate,
      locale: this.localeFor(this.locale),
    });
    return html`<span class="fiat" part="fiat"
      ><span aria-hidden="true">≈ </span
      ><span class="sr-only">approximately </span>${fiat.text}</span
    >`;
  }

  override render() {
    if (this.loading) {
      return html`<span class="wrap ${this.size}" part="base" aria-busy="true"
        ><ou-skeleton width="6em"></ou-skeleton
        ><span class="sr-only">${this.t('loading')}</span></span
      >`;
    }
    const f = this.formatted;
    if (!f)
      return html`<span class="wrap ${this.size}" part="base"
        ><span class="value" part="value">—</span></span
      >`;
    const value = this.#renderValue(f);
    const main =
      this.toggle && !this.privacy
        ? html`<button
            class="toggle"
            type="button"
            @click=${this.#cycle}
            aria-label="${f.srText}. ${this.t('changeUnit')}"
          >
            ${value}
          </button>`
        : value;
    return html`<span class="wrap ${this.size} ${this.direction ?? ''}" part="base">
      <span class="row">
        ${main}
        ${
          this.privacyToggle
            ? html`<button
                class="eye"
                part="privacy-toggle"
                type="button"
                aria-pressed=${this.privacy ? 'true' : 'false'}
                aria-label=${this.privacy ? this.t('showAmount') : this.t('hideAmount')}
                @click=${this.#togglePrivacy}
              >
                ${iconSvg(this.privacy ? 'hidden' : 'visible')}
              </button>`
            : nothing
        }
      </span>
      ${this.#renderFiat()}
    </span>`;
  }
}

define('ou-amount-display', OuAmountDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'ou-amount-display': OuAmountDisplay;
  }
}
