import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import { define } from '../../internal/define.js';
import { FormControlElement } from '../../internal/form-control.js';
import { baseStyles, fieldStyles } from '../../internal/styles.js';
import '../icon/icon.js';

/**
 * @summary Labelled text input with help text, error state, prefix/suffix slots and native form
 * participation.
 * @tag ou-input
 * @slot prefix - Content before the input.
 * @slot suffix - Content after the input (e.g. a unit or button).
 * @csspart label - The label.
 * @csspart control - The bordered input wrapper.
 * @csspart input - The native input.
 * @csspart help - Help text.
 * @csspart error - Error message.
 * @fires ou-input - On every edit. Detail: `{ value: string }`.
 * @fires ou-change - When the value is committed (blur/enter). Detail: `{ value: string }`.
 */
export class OuInput extends FormControlElement {
  static override styles = [baseStyles, fieldStyles, css``];

  static override properties = {
    ...FormControlElement.properties,
    value: { type: String },
    type: { type: String },
    placeholder: { type: String },
    readonly: { type: Boolean, reflect: true },
    autocomplete: { type: String },
    inputmode: { type: String },
    spellcheck: { type: Boolean },
    monospace: { type: Boolean },
    maxlength: { type: Number },
  };

  declare value: string;
  declare type: 'text' | 'email' | 'url' | 'search' | 'password' | 'tel' | 'number';
  declare placeholder: string | undefined;
  declare readonly: boolean;
  declare autocomplete: string | undefined;
  declare inputmode: string | undefined;
  declare spellcheck: boolean;
  /** Use the monospace font (addresses, invoices). */
  declare monospace: boolean;
  declare maxlength: number | undefined;

  #initialValue = '';

  constructor() {
    super();
    this.value = '';
    this.type = 'text';
    this.readonly = false;
    this.spellcheck = false;
    this.monospace = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#initialValue = this.value;
  }

  formResetCallback(): void {
    this.value = this.#initialValue;
  }

  get input(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input');
  }

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }

  select(): void {
    this.input?.select();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('value')) this.setFormValue(this.value);
    if (changed.has('error') || changed.has('value') || changed.has('required')) {
      this.invalid = Boolean(this.error);
      const missing = this.required && !this.value ? 'Please fill out this field.' : undefined;
      this.setValidity(this.error || missing, this.input);
    }
  }

  #onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    this.emit('ou-input', { value: this.value });
  }

  #onChange() {
    this.emit('ou-change', { value: this.value });
  }

  override render() {
    const hasError = Boolean(this.error);
    return html`<div class="field">
      ${
        this.label
          ? html`<label part="label" for=${this.ids.control}
              >${this.label}${this.required ? html`<span class="required" aria-hidden="true">*</span>` : nothing}</label
            >`
          : nothing
      }
      <div class="control" part="control">
        <slot name="prefix"></slot>
        <input
          part="input"
          id=${this.ids.control}
          class=${this.monospace ? 'mono' : ''}
          .value=${live(this.value)}
          type=${this.type}
          name=${this.name ?? nothing}
          placeholder=${this.placeholder ?? nothing}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          autocomplete=${this.autocomplete ?? nothing}
          inputmode=${this.inputmode ?? nothing}
          maxlength=${this.maxlength ?? nothing}
          spellcheck=${this.spellcheck ? 'true' : 'false'}
          autocapitalize="off"
          aria-label=${this.label ? nothing : (this.getAttribute('aria-label') ?? nothing)}
          aria-invalid=${hasError ? 'true' : 'false'}
          aria-describedby=${this.describedBy(hasError) ?? nothing}
          @input=${this.#onInput}
          @change=${this.#onChange}
        />
        <slot name="suffix"></slot>
      </div>
      ${this.helpText ? html`<div class="help" part="help" id=${this.ids.help}>${this.helpText}</div>` : nothing}
      <div id=${this.ids.error} aria-live="polite">
        ${
          hasError
            ? html`<div class="error" part="error">
                <ou-icon name="alert-circle"></ou-icon><span>${this.error}</span>
              </div>`
            : nothing
        }
      </div>
    </div>`;
  }
}

define('ou-input', OuInput);

declare global {
  interface HTMLElementTagNameMap {
    'ou-input': OuInput;
  }
}
