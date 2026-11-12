import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import { define } from '../../internal/define.js';
import { FormControlElement } from '../../internal/form-control.js';
import { baseStyles, fieldStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * @summary Labelled native select. Options come from the `options` property or from light-DOM
 * `<option>` children.
 * @tag ou-select
 * @csspart label - The label.
 * @csspart control - The bordered wrapper.
 * @csspart select - The native select.
 * @fires ou-change - When the selection changes. Detail: `{ value: string }`.
 */
export class OuSelect extends FormControlElement {
  static override styles = [
    baseStyles,
    fieldStyles,
    css`
      .control {
        position: relative;
        padding-inline-end: 0;
      }
      select {
        appearance: none;
        padding-inline-end: var(--ou-space-8);
        cursor: pointer;
      }
      .chevron {
        position: absolute;
        inset-inline-end: var(--ou-space-3);
        pointer-events: none;
        width: 1rem;
        height: 1rem;
        color: var(--ou-color-text-muted);
      }
      .chevron svg {
        width: 100%;
        height: 100%;
      }
      option {
        background: var(--ou-color-surface);
        color: var(--ou-color-text);
      }
    `,
  ];

  static override properties = {
    ...FormControlElement.properties,
    value: { type: String },
    options: { type: Array },
  };

  declare value: string;
  declare options: SelectOption[];

  constructor() {
    super();
    this.value = '';
    this.options = [];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.options.length) {
      const opts = [...this.querySelectorAll('option')];
      if (opts.length) {
        this.options = opts.map((o) => ({
          value: o.value,
          label: o.textContent?.trim() ?? o.value,
          disabled: o.disabled,
        }));
        if (!this.value) this.value = opts.find((o) => o.selected)?.value ?? this.options[0]!.value;
      }
    }
  }

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector('select')?.focus(options);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('value')) this.setFormValue(this.value);
    if (changed.has('error')) {
      this.invalid = Boolean(this.error);
      this.setValidity(this.error);
    }
  }

  #onChange(e: Event) {
    this.value = (e.target as HTMLSelectElement).value;
    this.emit('ou-change', { value: this.value });
  }

  override render() {
    const hasError = Boolean(this.error);
    return html`<div class="field">
      ${this.label ? html`<label part="label" for=${this.ids.control}>${this.label}</label>` : nothing}
      <div class="control" part="control">
        <select
          part="select"
          id=${this.ids.control}
          name=${this.name ?? nothing}
          .value=${live(this.value)}
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-label=${this.label ? nothing : (this.getAttribute('aria-label') ?? nothing)}
          aria-invalid=${hasError ? 'true' : 'false'}
          aria-describedby=${this.describedBy(hasError) ?? nothing}
          @change=${this.#onChange}
        >
          ${this.options.map(
            (o) =>
              html`<option
                value=${o.value}
                ?disabled=${o.disabled}
                ?selected=${o.value === this.value}
              >
                ${o.label}
              </option>`,
          )}
        </select>
        <span class="chevron">${iconSvg('caret-down')}</span>
      </div>
      ${this.helpText ? html`<div class="help" id=${this.ids.help}>${this.helpText}</div>` : nothing}
      ${hasError ? html`<div class="error" id=${this.ids.error} part="error">${this.error}</div>` : nothing}
    </div>`;
  }
}

define('ou-select', OuSelect);

declare global {
  interface HTMLElementTagNameMap {
    'ou-select': OuSelect;
  }
}
