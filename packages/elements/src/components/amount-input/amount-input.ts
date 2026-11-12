import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import {
  fiatToMsat,
  formatAmount,
  formatDecimal,
  fromMsat,
  localeSymbols,
  MSAT_PER_SAT,
  msatToFiat,
  normalizeNumberInput,
  toMsat,
  type FiatRate,
} from '@orange-ui/core';
import { resolveFiatRate } from '../../internal/amount.js';
import { bigintConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { FormControlElement } from '../../internal/form-control.js';
import { baseStyles, fieldStyles } from '../../internal/styles.js';
import '../icon/icon.js';

export type AmountInputUnit = 'sats' | 'btc' | 'fiat';

export interface AmountInputDetail {
  /** Whole sats, or undefined when empty/invalid. */
  amount: bigint | undefined;
  /** Millisats, or undefined when empty/invalid. */
  msat: bigint | undefined;
  valid: boolean;
  unit: AmountInputUnit;
  /** Raw text in the input. */
  text: string;
}

/**
 * @summary Bigint-safe amount entry with unit switcher (sats / BTC / fiat), fiat preview,
 * min/max validation and a "Max" button for the available balance.
 * @tag ou-amount-input
 * @csspart label - The label.
 * @csspart control - Bordered wrapper.
 * @csspart input - Native input.
 * @csspart unit-select - The unit switcher.
 * @csspart secondary - Fiat/sats preview line.
 * @csspart max-button - The Max button.
 * @csspart error - Error message.
 * @fires ou-input - On every edit. Detail: `AmountInputDetail`.
 * @fires ou-change - When the value is committed (blur, Max, unit change). Detail: `AmountInputDetail`.
 * @fires ou-unit-change - When the unit changes. Detail: `{ unit }`.
 */
export class OuAmountInput extends FormControlElement {
  static override styles = [
    baseStyles,
    fieldStyles,
    css`
      input {
        font-size: var(--ou-font-size-lg);
        font-variant-numeric: tabular-nums;
      }
      .unit {
        appearance: none;
        flex: none;
        width: auto;
        padding: var(--ou-space-1) var(--ou-space-2);
        border: 1px solid var(--ou-color-border);
        border-radius: var(--ou-radius-sm);
        background: var(--ou-color-surface-2);
        color: var(--ou-color-text);
        font: inherit;
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-semibold);
        cursor: pointer;
      }
      .unit:focus-visible {
        box-shadow: var(--ou-focus-ring);
      }
      .unit-static {
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-semibold);
        color: var(--ou-color-text-muted);
      }
      .below {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--ou-space-2);
        min-height: 1.5rem;
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-text-muted);
        font-variant-numeric: tabular-nums;
      }
      .avail {
        display: inline-flex;
        align-items: center;
        gap: var(--ou-space-2);
        margin-inline-start: auto;
      }
      .max {
        padding: 2px var(--ou-space-2);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-full);
        background: transparent;
        color: var(--ou-color-accent-text);
        font: inherit;
        font-size: var(--ou-font-size-xs);
        font-weight: var(--ou-font-weight-bold);
        cursor: pointer;
      }
      .max:hover {
        background: var(--ou-color-surface-2);
      }
    `,
  ];

  static override properties = {
    ...FormControlElement.properties,
    amount: { converter: bigintConverter },
    unit: { type: String, reflect: true },
    units: { type: Array },
    fiatRate: { attribute: false },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    min: { converter: bigintConverter },
    max: { converter: bigintConverter },
    balance: { converter: bigintConverter },
    locale: { type: String },
    placeholder: { type: String },
    allowMsat: { type: Boolean, attribute: 'allow-msat' },
    _text: { state: true },
    _validation: { state: true },
    _touched: { state: true },
  };

  /** Value in sats (bigint). Set it to prefill; read it after `ou-change`. */
  declare amount: bigint | undefined;
  /** Current entry unit. */
  declare unit: AmountInputUnit;
  /** Units offered in the switcher. Default `['sats', 'btc']` plus `fiat` when a rate is set. */
  declare units: AmountInputUnit[] | undefined;
  declare fiatRate: FiatRate | undefined;
  declare fiatCurrency: string | undefined;
  declare fiatPrice: string | undefined;
  /** Minimum in sats. */
  declare min: bigint | undefined;
  /** Maximum in sats. */
  declare max: bigint | undefined;
  /** Available balance in sats; enables the Max button and an insufficient-funds check. */
  declare balance: bigint | undefined;
  declare locale: string | undefined;
  declare placeholder: string | undefined;
  /** Accept sub-sat precision (Lightning). Default false. */
  declare allowMsat: boolean;
  declare _text: string;
  declare _validation: string | undefined;
  declare _touched: boolean;

  #msat: bigint | undefined;
  #lastAmount: bigint | undefined;
  #initial: bigint | undefined;

  constructor() {
    super();
    this.unit = 'sats';
    this.allowMsat = false;
    this._text = '';
    this._touched = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#initial = this.amount;
  }

  formResetCallback(): void {
    this.amount = this.#initial;
    this._touched = false;
  }

  /** Current value in msat (undefined when empty/invalid). */
  get msat(): bigint | undefined {
    return this.#msat;
  }

  get #rate(): FiatRate | undefined {
    return resolveFiatRate(this.fiatRate, this.fiatCurrency, this.fiatPrice, this.config.fiatRate);
  }

  get #unitOptions(): AmountInputUnit[] {
    const list = this.units ?? (['sats', 'btc', 'fiat'] as AmountInputUnit[]);
    return list.filter((u) => u !== 'fiat' || this.#rate);
  }

  get #locale() {
    return this.localeFor(this.locale);
  }

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector('input')?.focus(options);
  }

  /** Format msat as editable text in a unit (no grouping, locale decimal symbol). */
  #toText(msat: bigint, unit: AmountInputUnit): string {
    let plain: string;
    if (unit === 'btc')
      plain = fromMsat(msat, 'btc', { maxFractionDigits: this.allowMsat ? 11 : 8 });
    else if (unit === 'fiat') plain = msatToFiat(msat, this.#rate!).value;
    else plain = this.allowMsat ? fromMsat(msat, 'sat') : formatDecimal(msat / MSAT_PER_SAT, 0);
    return plain.replace('.', localeSymbols(this.#locale).decimal);
  }

  #parse(text: string): { msat?: bigint; error?: string } {
    if (!text.trim()) return {};
    const plain = normalizeNumberInput(text, this.#locale);
    if (plain.startsWith('-')) return { error: this.t('enterValidAmount') };
    try {
      let msat: bigint;
      if (this.unit === 'fiat') {
        const rate = this.#rate;
        if (!rate) return { error: this.t('enterValidAmount') };
        msat = fiatToMsat(plain, rate);
        if (!this.allowMsat) msat = ((msat + MSAT_PER_SAT / 2n) / MSAT_PER_SAT) * MSAT_PER_SAT;
      } else {
        msat = toMsat(plain, this.unit === 'btc' ? 'btc' : 'sat');
        if (!this.allowMsat && msat % MSAT_PER_SAT !== 0n) {
          return {
            error:
              this.unit === 'btc'
                ? 'Bitcoin amounts have at most 8 decimal places.'
                : 'Enter a whole number of sats.',
          };
        }
      }
      return { msat };
    } catch {
      return { error: this.t('enterValidAmount') };
    }
  }

  #validate(msat: bigint | undefined): string | undefined {
    if (msat === undefined)
      return this.required && this._touched ? this.t('enterValidAmount') : undefined;
    const sats = msat / MSAT_PER_SAT;
    const fmt = (s: bigint) =>
      formatAmount(s * MSAT_PER_SAT, { unit: 'sats', locale: this.#locale }).text;
    const min = toBigint(this.min);
    const max = toBigint(this.max);
    const bal = toBigint(this.balance);
    if (min !== undefined && sats < min) return this.t('minimumIs', { amount: fmt(min) });
    if (max !== undefined && sats > max) return this.t('maximumIs', { amount: fmt(max) });
    if (bal !== undefined && sats > bal) return this.t('notEnoughFunds', { amount: fmt(bal) });
    return undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // External `amount` changes rewrite the text (internal edits set #lastAmount first).
    if (changed.has('amount') && this.amount !== this.#lastAmount) {
      const sats = toBigint(this.amount);
      this.#msat = sats === undefined ? undefined : sats * MSAT_PER_SAT;
      this._text = this.#msat === undefined ? '' : this.#toText(this.#msat, this.unit);
      this.#lastAmount = this.amount;
    }
    if (!this.#unitOptions.includes(this.unit)) this.unit = this.#unitOptions[0] ?? 'sats';
    this._validation = this.error || this.#parseError || this.#validate(this.#msat);
  }

  #parseError: string | undefined;

  protected override updated(): void {
    this.invalid = Boolean(this._validation) && (this._touched || Boolean(this.error));
    this.setFormValue(this.amount === undefined ? null : String(this.amount));
    this.setValidity(this._validation, this.renderRoot.querySelector('input'));
  }

  #detail(): AmountInputDetail {
    return {
      amount: this.amount,
      msat: this.#msat,
      valid: !this._validation && (this.#msat !== undefined || !this.required),
      unit: this.unit,
      text: this._text,
    };
  }

  #apply(text: string) {
    this._text = text;
    const { msat, error } = this.#parse(text);
    this.#parseError = error;
    this.#msat = error ? undefined : msat;
    const sats = this.#msat === undefined ? undefined : this.#msat / MSAT_PER_SAT;
    this.#lastAmount = sats;
    this.amount = sats;
  }

  #onInput(e: Event) {
    this.#apply((e.target as HTMLInputElement).value);
    void this.updateComplete.then(() => this.emit('ou-input', this.#detail()));
  }

  #onBlur() {
    this._touched = true;
  }

  #onChange() {
    this._touched = true;
    void this.updateComplete.then(() => this.emit('ou-change', this.#detail()));
  }

  #onUnit(e: Event) {
    const next = (e.target as HTMLSelectElement).value as AmountInputUnit;
    const msat = this.#msat;
    this.unit = next;
    if (msat !== undefined) {
      this._text = this.#toText(msat, next);
      // Re-parse to normalise rounding when moving into fiat.
      if (next !== 'fiat') this.#apply(this._text);
    }
    this.emit('ou-unit-change', { unit: next });
    void this.updateComplete.then(() => this.emit('ou-change', this.#detail()));
  }

  #onMax() {
    const bal = toBigint(this.balance);
    if (bal === undefined) return;
    this._touched = true;
    this.#apply(this.#toText(bal * MSAT_PER_SAT, this.unit));
    // Keep the exact balance even when the displayed unit rounds (fiat).
    this.#parseError = undefined;
    this.#msat = bal * MSAT_PER_SAT;
    this.#lastAmount = bal;
    this.amount = bal;
    void this.updateComplete.then(() => this.emit('ou-change', this.#detail()));
  }

  #unitLabel(u: AmountInputUnit): string {
    if (u === 'fiat') return this.#rate?.currency.toUpperCase() ?? 'Fiat';
    return u === 'btc' ? 'BTC' : 'sats';
  }

  #secondary() {
    const rate = this.#rate;
    const msat = this.#msat;
    if (msat === undefined) return nothing;
    if (this.unit === 'fiat') {
      return html`<span
        >≈ ${formatAmount(msat, { unit: 'sats', locale: this.#locale }).text}</span
      >`;
    }
    if (!rate) return nothing;
    return html`<span
      >≈ ${formatAmount(msat, { unit: 'fiat', fiatRate: rate, locale: this.#locale }).text}</span
    >`;
  }

  override render() {
    const units = this.#unitOptions;
    const showError = this.invalid && this._validation;
    const bal = toBigint(this.balance);
    return html`<div class="field">
      ${
        this.label
          ? html`<label part="label" for=${this.ids.control}
              >${this.label}${this.required ? html`<span class="required" aria-hidden="true">*</span>` : nothing}</label
            >`
          : nothing
      }
      <div class="control" part="control">
        <input
          part="input"
          id=${this.ids.control}
          name=${this.name ?? nothing}
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          .value=${live(this._text)}
          placeholder=${this.placeholder ?? (this.unit === 'btc' ? '0.00000000' : '0')}
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-label=${this.label ? nothing : this.t('amount')}
          aria-invalid=${showError ? 'true' : 'false'}
          aria-describedby=${[this.ids.help, showError ? this.ids.error : ''].filter(Boolean).join(' ')}
          @input=${this.#onInput}
          @change=${this.#onChange}
          @blur=${this.#onBlur}
        />
        ${
          units.length > 1
            ? html`<select
                class="unit"
                part="unit-select"
                aria-label=${this.t('unit')}
                .value=${live(this.unit)}
                ?disabled=${this.disabled}
                @change=${this.#onUnit}
              >
                ${units.map((u) => html`<option value=${u} ?selected=${u === this.unit}>${this.#unitLabel(u)}</option>`)}
              </select>`
            : html`<span class="unit-static">${this.#unitLabel(this.unit)}</span>`
        }
      </div>
      <div class="below" part="secondary" id=${this.ids.help}>
        <span aria-live="polite">${this.#secondary()}</span>
        ${
          bal !== undefined
            ? html`<span class="avail"
                >${this.t('available', { amount: formatAmount(bal * MSAT_PER_SAT, { unit: 'sats', locale: this.#locale }).text })}
                <button
                  class="max"
                  part="max-button"
                  type="button"
                  ?disabled=${this.disabled}
                  @click=${this.#onMax}
                >
                  ${this.t('max')}
                </button></span
              >`
            : nothing
        }
      </div>
      ${this.helpText ? html`<div class="help">${this.helpText}</div>` : nothing}
      <div id=${this.ids.error} aria-live="polite">
        ${showError ? html`<div class="error" part="error"><ou-icon name="alert-circle"></ou-icon><span>${this._validation}</span></div>` : nothing}
      </div>
    </div>`;
  }
}

define('ou-amount-input', OuAmountInput);

declare global {
  interface HTMLElementTagNameMap {
    'ou-amount-input': OuAmountInput;
  }
}
