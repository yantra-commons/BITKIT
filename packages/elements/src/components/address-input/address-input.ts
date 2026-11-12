import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import {
  ADDRESS_TYPE_LABELS,
  formatAmount,
  NETWORK_LABELS,
  parsePaymentInput,
  type Network,
  type PaymentInput,
  type PaymentInputType,
} from '@orange-ui/core';
import { listConverter } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { FormControlElement } from '../../internal/form-control.js';
import { baseStyles, fieldStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../dialog/dialog.js';
import '../qr-scanner/qr-scanner.js';

type Accepted = Exclude<PaymentInputType, 'invalid'>;

export interface AddressInputDetail {
  value: string;
  result: PaymentInput | undefined;
  valid: boolean;
}

/** Short human description of a parsed destination. */
export function describePaymentInput(r: PaymentInput, locale?: string): string {
  const amt = (msat: bigint | null | undefined) =>
    msat ? ` · ${formatAmount(msat, { unit: 'auto', locale }).text}` : '';
  switch (r.type) {
    case 'onchain-address':
      return `${ADDRESS_TYPE_LABELS[r.address.type]} · ${NETWORK_LABELS[r.network]}`;
    case 'bip21':
      return `Payment link${r.invoice ? ' with Lightning' : ''}${amt(r.uri.amountMsat ?? r.invoice?.amountMsat)}`;
    case 'bolt11':
      return `Lightning invoice${amt(r.invoice.amountMsat)}${r.invoice.description ? ` · ${r.invoice.description}` : ''}`;
    case 'bolt12-offer':
      return `Lightning offer${r.offer.description ? ` · ${r.offer.description}` : ''}`;
    case 'lnurl':
      return `LNURL${r.lnurl.kind !== 'unknown' ? ` (${r.lnurl.kind})` : ''} · ${new URL(r.lnurl.url).host}`;
    case 'lightning-address':
      return `Lightning Address · ${r.lightningAddress.domain}`;
    default:
      return '';
  }
}

/**
 * @summary Destination input that validates as you type and accepts paste and QR scan. Uses
 * `parsePaymentInput` from core, so it understands addresses, BIP21 / unified QR, BOLT11,
 * BOLT12 offers, LNURL and Lightning Addresses (restrict with `accept`).
 * @tag ou-address-input
 * @csspart label - Label.
 * @csspart control - Bordered wrapper.
 * @csspart input - The textarea.
 * @csspart status - Detected-type line.
 * @csspart error - Error message.
 * @fires ou-input - On each edit. Detail: `AddressInputDetail`.
 * @fires ou-change - When a value is committed (blur, paste, scan). Detail: `AddressInputDetail`.
 */
export class OuAddressInput extends FormControlElement {
  static override styles = [
    baseStyles,
    fieldStyles,
    css`
      .control {
        align-items: flex-start;
        padding-block: var(--ou-space-1);
      }
      textarea {
        resize: none;
        min-height: 1.6em;
        line-height: 1.5;
        font-family: var(--ou-font-mono);
        font-size: var(--ou-font-size-sm);
        word-break: break-all;
        field-sizing: content;
        max-height: 8em;
      }
      .tools {
        display: inline-flex;
        gap: 2px;
        padding-top: 2px;
      }
      .tool {
        display: inline-grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        border: 0;
        border-radius: var(--ou-radius-sm);
        background: transparent;
        color: var(--ou-color-text-muted);
        cursor: pointer;
      }
      .tool:hover {
        background: var(--ou-color-surface-2);
        color: var(--ou-color-text);
      }
      .tool svg {
        width: 1.2rem;
        height: 1.2rem;
      }
      .status {
        display: flex;
        align-items: center;
        gap: var(--ou-space-1);
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-success);
        min-height: 1.25rem;
      }
      .status svg {
        width: 1rem;
        height: 1rem;
        flex: none;
      }
      .status span {
        color: var(--ou-color-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  static override properties = {
    ...FormControlElement.properties,
    value: { type: String },
    network: { type: String },
    accept: { converter: listConverter },
    placeholder: { type: String },
    scan: { type: Boolean },
    paste: { type: Boolean },
    locale: { type: String },
    _result: { state: true },
    _touched: { state: true },
    _scanning: { state: true },
  };

  declare value: string;
  /** Expected network; defaults to the global config network. */
  declare network: Network | undefined;
  /**
   * Accepted destination types. Default: `onchain-address,bip21`. Use
   * `onchain-address,bip21,bolt11,bolt12-offer,lnurl,lightning-address` for "anything payable".
   */
  declare accept: Accepted[];
  declare placeholder: string | undefined;
  /** Show the scan button. Default true. */
  declare scan: boolean;
  /** Show the paste button (when the Clipboard API is available). Default true. */
  declare paste: boolean;
  declare locale: string | undefined;
  declare _result: PaymentInput | undefined;
  declare _touched: boolean;
  declare _scanning: boolean;

  #initial = '';

  constructor() {
    super();
    this.value = '';
    this.accept = ['onchain-address', 'bip21'];
    this.scan = true;
    this.paste = true;
    this._touched = false;
    this._scanning = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#initial = this.value;
  }

  formResetCallback(): void {
    this.value = this.#initial;
    this._touched = false;
  }

  /** The parsed result for the current value. */
  get result(): PaymentInput | undefined {
    return this._result;
  }

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector('textarea')?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') || changed.has('network') || changed.has('accept')) {
      const v = this.value.trim();
      this._result = v
        ? parsePaymentInput(v, {
            network: this.network ?? this.config.network,
            accept: this.accept.length ? this.accept : undefined,
          })
        : undefined;
    }
  }

  get #error(): string | undefined {
    if (this.error) return this.error;
    const r = this._result;
    if (!r) return this.required && this._touched ? 'Enter a destination.' : undefined;
    return r.type === 'invalid' ? r.error.message : undefined;
  }

  protected override updated(): void {
    const err = this.#error;
    // Show errors once the user has left the field or the input clearly looks complete.
    const looksComplete = this.value.trim().length >= 26;
    this.invalid = Boolean(err) && (this._touched || looksComplete || Boolean(this.error));
    this.setFormValue(this.value || null);
    this.setValidity(err, this.renderRoot.querySelector('textarea'));
  }

  #detail(): AddressInputDetail {
    return {
      value: this.value.trim(),
      result: this._result,
      valid: !!this._result && this._result.type !== 'invalid',
    };
  }

  #set(value: string, commit: boolean) {
    this.value = value;
    void this.updateComplete.then(() => {
      this.emit('ou-input', this.#detail());
      if (commit) this.emit('ou-change', this.#detail());
    });
  }

  #onInput(e: Event) {
    // Strip newlines: destinations are single-line.
    this.#set((e.target as HTMLTextAreaElement).value.replace(/[\r\n]+/g, ''), false);
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._touched = true;
      this.emit('ou-change', this.#detail());
      this.form?.requestSubmit();
    }
  }

  #onBlur() {
    this._touched = true;
    this.emit('ou-change', this.#detail());
  }

  async #paste() {
    try {
      const text = await navigator.clipboard.readText();
      this._touched = true;
      this.#set(text.trim(), true);
    } catch {
      this.focus();
    }
  }

  #clear() {
    this._touched = false;
    this.#set('', true);
    this.focus();
  }

  #onScan(e: CustomEvent<{ value: string }>) {
    this._scanning = false;
    this._touched = true;
    this.#set(e.detail.value.trim(), true);
  }

  override render() {
    const err = this.#error;
    const showError = this.invalid && err;
    const r = this._result;
    const ok = r && r.type !== 'invalid';
    const canPaste =
      this.paste && typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
    return html`<div class="field">
      <label part="label" for=${this.ids.control}
        >${this.label ?? this.t('recipient')}${this.required ? html`<span class="required" aria-hidden="true">*</span>` : nothing}</label
      >
      <div class="control" part="control">
        <textarea
          part="input"
          id=${this.ids.control}
          rows="1"
          name=${this.name ?? nothing}
          .value=${live(this.value)}
          placeholder=${this.placeholder ?? this.t('recipientPlaceholder')}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-invalid=${showError ? 'true' : 'false'}
          aria-describedby="${this.ids.help} ${showError ? this.ids.error : ''}"
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
          @blur=${this.#onBlur}
        ></textarea>
        <span class="tools">
          ${
            this.value
              ? html`<button
                  class="tool"
                  type="button"
                  aria-label=${this.t('clear')}
                  title=${this.t('clear')}
                  ?disabled=${this.disabled}
                  @click=${this.#clear}
                >
                  ${iconSvg('cross')}
                </button>`
              : canPaste
                ? html`<button
                    class="tool"
                    type="button"
                    aria-label=${this.t('paste')}
                    title=${this.t('paste')}
                    ?disabled=${this.disabled}
                    @click=${this.#paste}
                  >
                    ${iconSvg('copy')}
                  </button>`
                : nothing
          }
          ${
            this.scan
              ? html`<button
                  class="tool"
                  type="button"
                  aria-label=${this.t('scan')}
                  title=${this.t('scan')}
                  ?disabled=${this.disabled}
                  @click=${() => (this._scanning = true)}
                >
                  ${iconSvg('scan')}
                </button>`
              : nothing
          }
        </span>
      </div>
      <div class="status" part="status" id=${this.ids.help} aria-live="polite">
        ${ok ? html`${iconSvg('check')}<span>${describePaymentInput(r, this.localeFor(this.locale))}</span>` : this.helpText ? html`<span>${this.helpText}</span>` : nothing}
      </div>
      <div id=${this.ids.error} aria-live="polite">
        ${showError ? html`<div class="error" part="error">${iconSvg('alert-circle')}<span>${err}</span></div>` : nothing}
      </div>
      ${
        this.scan
          ? html`<ou-dialog
              label=${this.t('scan')}
              ?open=${this._scanning}
              @ou-close=${() => (this._scanning = false)}
            >
              <ou-qr-scanner ?active=${this._scanning} @ou-scan=${this.#onScan}></ou-qr-scanner>
            </ou-dialog>`
          : nothing
      }
    </div>`;
  }
}

define('ou-address-input', OuAddressInput);

declare global {
  interface HTMLElementTagNameMap {
    'ou-address-input': OuAddressInput;
  }
}
