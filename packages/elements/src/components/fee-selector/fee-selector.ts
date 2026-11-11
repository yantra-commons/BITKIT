import { css, html, nothing, type PropertyValues } from 'lit';
import {
  checkFeeRate,
  feeForVsize,
  feeTiersFromRecommended,
  formatAmount,
  formatEta,
  MSAT_PER_SAT,
  type FeeTier,
  type FeeTierOption,
  type FiatRate,
  type RecommendedFees,
} from '@bitkit-ui/core';
import { MempoolRates, type FeeRateAdapter } from '@bitkit-ui/adapters';
import { resolveFiatRate } from '../../internal/amount.js';
import { BitkitElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import '../button/button.js';
import '../skeleton/skeleton.js';

export interface FeeSelection {
  tier: FeeTier;
  /** Exact decimal sat/vB. */
  satPerVb: string;
  /** Total fee in sats for `vsize` (undefined without vsize). */
  feeSats: bigint | undefined;
}

/**
 * @summary Network fee picker: fast / normal / slow tiers with sat/vB, total fee, fiat cost and
 * ETA, plus a validated custom rate. Rates come from a FeeRateAdapter (mempool.space by default,
 * configurable via `mempool-url`) or a static `fees` object.
 * @tag bk-fee-selector
 * @csspart base - Fieldset.
 * @csspart option - Each tier option.
 * @csspart custom - Custom rate input.
 * @fires bk-change - Detail: `FeeSelection`.
 */
export class BkFeeSelector extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
        min-width: 0;
      }
      legend {
        margin-bottom: var(--bk-space-2);
        font-size: var(--bk-font-size-sm);
        font-weight: var(--bk-font-weight-medium);
      }
      .opts {
        display: grid;
        gap: var(--bk-space-2);
      }
      label.opt {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: var(--bk-space-3);
        padding: var(--bk-space-3);
        border: 1px solid var(--bk-color-border-strong);
        border-radius: var(--bk-radius-md);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      label.opt:has(input:checked) {
        border-color: var(--bk-color-accent);
        box-shadow: inset 0 0 0 1px var(--bk-color-accent);
      }
      label.opt:has(input:focus-visible) {
        box-shadow: var(--bk-focus-ring);
      }
      input[type='radio'] {
        accent-color: var(--bk-color-accent);
        width: 1.1rem;
        height: 1.1rem;
        margin: 0;
      }
      .name {
        font-weight: var(--bk-font-weight-semibold);
      }
      .sub {
        display: block;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text-muted);
      }
      .cost {
        text-align: end;
      }
      .custom {
        display: flex;
        align-items: center;
        gap: var(--bk-space-2);
        margin-top: var(--bk-space-2);
      }
      .custom input {
        width: 7rem;
        min-height: var(--bk-control-height-md);
        padding: 0 var(--bk-space-2);
        border: 1px solid var(--bk-color-border-strong);
        border-radius: var(--bk-radius-sm);
        background: var(--bk-color-surface);
        color: inherit;
        font: inherit;
      }
      .warn {
        margin: var(--bk-space-1) 0 0;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-warning);
      }
      .bad {
        color: var(--bk-color-danger);
      }
      .error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--bk-space-2);
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-danger);
      }
    `,
  ];

  static override properties = {
    fees: { attribute: false },
    source: { attribute: false },
    mempoolUrl: { type: String, attribute: 'mempool-url' },
    vsize: { type: Number },
    value: { type: String, reflect: true },
    customRate: { type: String, attribute: 'custom-rate' },
    allowCustom: { type: Boolean, attribute: 'allow-custom' },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    fiatRate: { attribute: false },
    locale: { type: String },
    _loading: { state: true },
    _error: { state: true },
    _fetched: { state: true },
  };

  /** Static recommended fees (skips fetching). */
  declare fees: RecommendedFees | undefined;
  /** Custom fee source. */
  declare source: FeeRateAdapter | undefined;
  /** mempool.space-compatible API base used when no `fees`/`source` is set. */
  declare mempoolUrl: string | undefined;
  /** Transaction virtual size in vbytes, for total-fee display. */
  declare vsize: number | undefined;
  /** Selected tier. Default `normal`. */
  declare value: FeeTier;
  /** Custom sat/vB when `value` is `custom`. */
  declare customRate: string;
  declare allowCustom: boolean;
  declare fiatCurrency: string | undefined;
  declare fiatPrice: string | undefined;
  declare fiatRate: FiatRate | undefined;
  declare locale: string | undefined;
  declare _loading: boolean;
  declare _error: string | undefined;
  declare _fetched: RecommendedFees | undefined;

  #name = nextId('fee');
  #req = 0;

  constructor() {
    super();
    this.value = 'normal';
    this.customRate = '';
    this.allowCustom = true;
    this._loading = false;
  }

  #started = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Fetch on first render and whenever the source changes.
    if (!this.fees && (!this.#started || changed.has('source') || changed.has('mempoolUrl'))) {
      this.#started = true;
      void this.refresh();
    }
  }

  /** Re-fetch fee estimates. */
  async refresh(): Promise<void> {
    if (this.fees) return;
    const id = ++this.#req;
    const src = this.source ?? new MempoolRates({ baseUrl: this.mempoolUrl });
    this._loading = true;
    this._error = undefined;
    try {
      const f = await src.getRecommendedFees();
      if (id === this.#req) this._fetched = f;
    } catch {
      if (id === this.#req) this._error = 'Could not load fee estimates.';
    } finally {
      if (id === this.#req) this._loading = false;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('_fetched') || changed.has('fees')) this.#emit();
  }

  get #recommended(): RecommendedFees | undefined {
    return this.fees ?? this._fetched;
  }

  get #tiers(): FeeTierOption[] {
    const r = this.#recommended;
    return r ? feeTiersFromRecommended(r) : [];
  }

  /** The current selection. */
  get selection(): FeeSelection | undefined {
    const tier = this.value;
    let rate: string | undefined;
    if (tier === 'custom') {
      if (!checkFeeRate(this.customRate || '0', this.#recommended).ok) return undefined;
      rate = this.customRate;
    } else rate = this.#tiers.find((t) => t.tier === tier)?.satPerVb;
    if (!rate) return undefined;
    return {
      tier,
      satPerVb: rate,
      feeSats: this.vsize ? feeForVsize(this.vsize, rate) : undefined,
    };
  }

  #emit() {
    const s = this.selection;
    if (s) this.emit('bk-change', s);
  }

  #select(tier: FeeTier) {
    this.value = tier;
    void this.updateComplete.then(() => this.#emit());
  }

  #cost(rate: string) {
    if (!this.vsize) return nothing;
    const sats = feeForVsize(this.vsize, rate);
    const locale = this.localeFor(this.locale);
    const fiat = resolveFiatRate(
      this.fiatRate,
      this.fiatCurrency,
      this.fiatPrice,
      this.config.fiatRate,
    );
    return html`<span class="cost"
      >${formatAmount(sats * MSAT_PER_SAT, { unit: 'sats', locale }).text}
      ${fiat ? html`<span class="sub">≈ ${formatAmount(sats * MSAT_PER_SAT, { unit: 'fiat', fiatRate: fiat, locale }).text}</span>` : nothing}</span
    >`;
  }

  override render() {
    if (this._loading && !this.#recommended) {
      return html`<div aria-busy="true">
        <span class="sr-only" role="status">Loading fee estimates</span>
        ${[0, 1, 2].map(() => html`<bk-skeleton shape="rect" height="3.5rem" style="margin-bottom:.5rem"></bk-skeleton>`)}
      </div>`;
    }
    if (this._error && !this.#recommended) {
      return html`<div class="error" role="alert">
        <span>${this._error}</span
        ><bk-button size="sm" variant="secondary" @click=${() => this.refresh()}>Retry</bk-button>
      </div>`;
    }
    const check =
      this.value === 'custom' && this.customRate
        ? checkFeeRate(this.customRate, this.#recommended)
        : undefined;
    return html`<fieldset part="base">
      <legend>Network fee</legend>
      <div class="opts">
        ${this.#tiers.map(
          (t) =>
            html`<label class="opt" part="option">
              <input
                type="radio"
                name=${this.#name}
                .checked=${this.value === t.tier}
                @change=${() => this.#select(t.tier)}
              />
              <span
                ><span class="name">${t.label}</span>
                <span class="sub">${formatEta(t.etaMinutes)} · ${t.satPerVb} sat/vB</span></span
              >
              ${this.#cost(t.satPerVb)}
            </label>`,
        )}
        ${
          this.allowCustom
            ? html`<label class="opt" part="option">
                <input
                  type="radio"
                  name=${this.#name}
                  .checked=${this.value === 'custom'}
                  @change=${() => this.#select('custom')}
                />
                <span
                  ><span class="name">Custom</span><span class="sub">Set your own rate</span></span
                >
                ${this.value === 'custom' && check?.ok ? this.#cost(this.customRate) : nothing}
              </label>`
            : nothing
        }
      </div>
      ${
        this.value === 'custom'
          ? html`<div class="custom" part="custom">
                <input
                  id="${this.#name}-custom"
                  inputmode="decimal"
                  aria-label="Custom fee rate in sats per virtual byte"
                  aria-describedby="${this.#name}-warn"
                  .value=${this.customRate}
                  @input=${(e: Event) => {
                    this.customRate = (e.target as HTMLInputElement).value.trim();
                    void this.updateComplete.then(() => this.#emit());
                  }}
                /><span>sat/vB</span>
              </div>
              <p
                id="${this.#name}-warn"
                class="warn ${check && !check.ok ? 'bad' : ''}"
                aria-live="polite"
              >
                ${check?.message ?? ''}
              </p>`
          : nothing
      }
    </fieldset>`;
  }
}

define('bk-fee-selector', BkFeeSelector);

declare global {
  interface HTMLElementTagNameMap {
    'bk-fee-selector': BkFeeSelector;
  }
}
