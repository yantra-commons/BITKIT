import { css, html, nothing } from 'lit';
import { formatAmount, MSAT_PER_SAT, type FiatRate } from '@orange-ui/core';
import type { PaymentAdapter, PaymentMethod } from '@orange-ui/adapters';
import { resolveFiatRate } from '../../internal/amount.js';
import { OrangeElement, nextId } from '../../internal/base.js';
import { bigintConverter, listConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import type { AmountInputDetail } from '../amount-input/amount-input.js';
import '../amount-input/amount-input.js';
import '../button/button.js';
import '../checkout/checkout.js';

/**
 * @summary Donation form: preset amounts, custom amount, optional message, then a checkout.
 * @tag ou-donation-widget
 * @slot description - Text under the heading.
 * @csspart base - Container.
 * @csspart presets - Preset amount group.
 * @csspart preset - Each preset button.
 * @csspart message - Message textarea.
 * @csspart submit - Donate button.
 * @fires ou-donate - Before the checkout opens. Detail: `{ amount: bigint, message: string }`.
 */
export class OuDonationWidget extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .w {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-4);
        padding: var(--ou-space-5);
        border: 1px solid var(--ou-color-border);
        border-radius: var(--ou-radius-lg);
        background: var(--ou-color-surface);
        box-shadow: var(--ou-shadow-sm);
      }
      h2 {
        margin: 0;
        font-size: var(--ou-font-size-lg);
      }
      ::slotted([slot='description']) {
        margin: 0;
        color: var(--ou-color-text-muted);
        font-size: var(--ou-font-size-sm);
      }
      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
        min-width: 0;
      }
      legend {
        margin-bottom: var(--ou-space-2);
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-medium);
      }
      .presets {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
        gap: var(--ou-space-2);
      }
      .preset {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: var(--ou-space-3) var(--ou-space-2);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-surface);
        color: var(--ou-color-text);
        font: inherit;
        font-weight: var(--ou-font-weight-semibold);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      .preset small {
        font-weight: var(--ou-font-weight-regular);
        color: var(--ou-color-text-muted);
        font-size: var(--ou-font-size-xs);
      }
      .preset[aria-checked='true'] {
        border-color: var(--ou-color-accent);
        box-shadow: inset 0 0 0 1px var(--ou-color-accent);
        background: color-mix(in srgb, var(--ou-color-accent) 8%, var(--ou-color-surface));
      }
      label {
        display: block;
        margin-bottom: var(--ou-space-1);
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-medium);
      }
      textarea {
        width: 100%;
        min-height: 4.5rem;
        padding: var(--ou-space-2) var(--ou-space-3);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-surface);
        color: inherit;
        font: inherit;
        resize: vertical;
      }
      textarea:focus-visible {
        border-color: var(--ou-color-focus);
      }
      .count {
        text-align: end;
        font-size: var(--ou-font-size-xs);
        color: var(--ou-color-text-muted);
      }
    `,
  ];

  static override properties = {
    adapter: {},
    heading: { type: String },
    presets: { converter: listConverter },
    allowCustom: { type: Boolean, attribute: 'allow-custom' },
    allowMessage: { type: Boolean, attribute: 'allow-message' },
    messageMax: { type: Number, attribute: 'message-max' },
    min: { converter: bigintConverter },
    defaultAmount: { converter: bigintConverter, attribute: 'default-amount' },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    fiatRate: { attribute: false },
    methods: { converter: listConverter },
    locale: { type: String },
    _amount: { state: true },
    _custom: { state: true },
    _message: { state: true },
    _open: { state: true },
  };

  declare adapter: PaymentAdapter | string | undefined;
  declare heading: string;
  /** Preset amounts in sats. Default `1000,5000,21000,100000`. */
  declare presets: string[];
  declare allowCustom: boolean;
  declare allowMessage: boolean;
  declare messageMax: number;
  /** Minimum donation in sats. Default 100. */
  declare min: bigint | undefined;
  declare defaultAmount: bigint | undefined;
  declare fiatCurrency: string | undefined;
  declare fiatPrice: string | undefined;
  declare fiatRate: FiatRate | undefined;
  declare methods: PaymentMethod[];
  declare locale: string | undefined;
  declare _amount: bigint | undefined;
  declare _custom: boolean;
  declare _message: string;
  declare _open: boolean;

  #msgId = nextId('msg');

  constructor() {
    super();
    this.heading = 'Support this project';
    this.presets = ['1000', '5000', '21000', '100000'];
    this.allowCustom = true;
    this.allowMessage = true;
    this.messageMax = 140;
    this.methods = ['lightning', 'onchain'];
    this._custom = false;
    this._message = '';
    this._open = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._amount ??= toBigint(this.defaultAmount) ?? toBigint(this.presets[1] ?? this.presets[0]);
  }

  get #rate(): FiatRate | undefined {
    return resolveFiatRate(this.fiatRate, this.fiatCurrency, this.fiatPrice, this.config.fiatRate);
  }

  get #presetValues(): bigint[] {
    return this.presets
      .map((p) => toBigint(p))
      .filter((p): p is bigint => p !== undefined && p > 0n);
  }

  #fmt(sats: bigint, unit: 'sats' | 'fiat' = 'sats') {
    return formatAmount(sats * MSAT_PER_SAT, {
      unit,
      fiatRate: this.#rate,
      locale: this.localeFor(this.locale),
    }).text;
  }

  #onPresetKey(e: KeyboardEvent) {
    const values = this.#presetValues;
    const options: (bigint | 'custom')[] = [
      ...values,
      ...(this.allowCustom ? (['custom'] as const) : []),
    ];
    const current = this._custom ? 'custom' : this._amount;
    let i = options.findIndex((o) => o === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      i = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    this.#choose(options[i]!);
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLButtonElement>('[role=radio][aria-checked=true]')?.focus(),
    );
  }

  #choose(v: bigint | 'custom') {
    if (v === 'custom') {
      this._custom = true;
      this._amount = undefined;
    } else {
      this._custom = false;
      this._amount = v;
    }
  }

  #donate() {
    const amount = this._amount;
    const min = toBigint(this.min) ?? 100n;
    if (amount === undefined || amount < min) return;
    this.emit('ou-donate', { amount, message: this._message });
    this._open = true;
  }

  override render() {
    const values = this.#presetValues;
    const min = toBigint(this.min) ?? 100n;
    const valid = this._amount !== undefined && this._amount >= min;
    const rate = this.#rate;
    return html`<div class="w" part="base">
      <div>
        <h2>${this.heading}</h2>
        <slot name="description"></slot>
      </div>
      <fieldset>
        <legend>Choose an amount</legend>
        <div
          class="presets"
          part="presets"
          role="radiogroup"
          aria-label="Donation amount"
          @keydown=${this.#onPresetKey}
        >
          ${values.map((v) => {
            const checked = !this._custom && this._amount === v;
            return html`<button
              class="preset"
              part="preset"
              type="button"
              role="radio"
              aria-checked=${checked ? 'true' : 'false'}
              tabindex=${checked || (!values.includes(this._amount ?? -1n) && !this._custom && v === values[0]) ? '0' : '-1'}
              @click=${() => this.#choose(v)}
            >
              <span>${this.#fmt(v)}</span
              >${rate ? html`<small>≈ ${this.#fmt(v, 'fiat')}</small>` : nothing}
            </button>`;
          })}
          ${
            this.allowCustom
              ? html`<button
                  class="preset"
                  part="preset"
                  type="button"
                  role="radio"
                  aria-checked=${this._custom ? 'true' : 'false'}
                  tabindex=${this._custom ? '0' : '-1'}
                  @click=${() => this.#choose('custom')}
                >
                  <span>Custom</span>
                </button>`
              : nothing
          }
        </div>
      </fieldset>
      ${
        this._custom
          ? html`<ou-amount-input
              label="Custom amount"
              .min=${min}
              .fiatRate=${rate}
              locale=${this.locale ?? nothing}
              @ou-input=${(e: CustomEvent<AmountInputDetail>) => (this._amount = e.detail.valid ? e.detail.amount : undefined)}
            ></ou-amount-input>`
          : nothing
      }
      ${
        this.allowMessage
          ? html`<div>
              <label for=${this.#msgId}
                >Message
                <span style="font-weight:400;color:var(--ou-color-text-muted)"
                  >(optional)</span
                ></label
              >
              <textarea
                id=${this.#msgId}
                part="message"
                maxlength=${this.messageMax}
                .value=${this._message}
                aria-describedby="${this.#msgId}-count"
                @input=${(e: Event) => (this._message = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
              <div class="count" id="${this.#msgId}-count">
                ${this._message.length}/${this.messageMax}
              </div>
            </div>`
          : nothing
      }
      <ou-button part="submit" block size="lg" ?disabled=${!valid} @click=${this.#donate}
        >Donate${valid ? ` ${this.#fmt(this._amount!)}` : ''}</ou-button
      >
      <ou-checkout
        mode="modal"
        heading=${this.heading}
        .adapter=${this.adapter}
        .amount=${this._amount}
        .fiatRate=${rate}
        .methods=${this.methods}
        description=${this._message || this.heading}
        ?open=${this._open}
        @ou-close=${() => (this._open = false)}
      ></ou-checkout>
    </div>`;
  }
}

define('ou-donation-widget', OuDonationWidget);

declare global {
  interface HTMLElementTagNameMap {
    'ou-donation-widget': OuDonationWidget;
  }
}
