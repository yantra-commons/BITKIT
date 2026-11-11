import { css, html, nothing, type PropertyValues } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import '../spinner/spinner.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shared button look, reused by icon-button, copy-button and composite components. */
export const buttonStyles = css`
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--bk-space-2);
    width: 100%;
    min-height: var(--bk-control-height-md);
    padding: 0 var(--bk-space-4);
    border: 1px solid transparent;
    border-radius: var(--bk-radius-md);
    font: inherit;
    font-size: var(--bk-font-size-md);
    font-weight: var(--bk-font-weight-semibold);
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    transition:
      background-color var(--bk-duration-fast) var(--bk-easing-standard),
      border-color var(--bk-duration-fast) var(--bk-easing-standard),
      transform var(--bk-duration-fast) var(--bk-easing-standard);
  }
  .btn:active:not([aria-disabled='true']) {
    transform: translateY(1px);
  }
  .sm {
    min-height: var(--bk-control-height-sm);
    padding: 0 var(--bk-space-3);
    font-size: var(--bk-font-size-sm);
  }
  .lg {
    min-height: var(--bk-control-height-lg);
    padding: 0 var(--bk-space-6);
    font-size: var(--bk-font-size-lg);
  }
  .primary {
    background: var(--bk-color-accent);
    color: var(--bk-color-on-accent);
  }
  .primary:hover:not([aria-disabled='true']) {
    background: var(--bk-color-accent-hover);
  }
  .secondary {
    background: var(--bk-color-surface);
    color: var(--bk-color-text);
    border-color: var(--bk-color-border-strong);
  }
  .secondary:hover:not([aria-disabled='true']) {
    background: var(--bk-color-surface-2);
  }
  .ghost {
    background: transparent;
    color: var(--bk-color-text);
  }
  .ghost:hover:not([aria-disabled='true']) {
    background: var(--bk-color-surface-2);
  }
  .danger {
    background: var(--bk-color-danger);
    color: var(--bk-color-bg);
  }
  .btn[aria-disabled='true'] {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .btn.loading .content {
    visibility: hidden;
  }
  .btn bk-spinner {
    position: absolute;
    inset: 0;
    margin: auto;
    width: fit-content;
    height: fit-content;
  }
  .content {
    display: inline-flex;
    align-items: center;
    gap: var(--bk-space-2);
  }
  @media (forced-colors: active) {
    .btn {
      border-color: ButtonText;
    }
  }
`;

/**
 * @summary Accessible button with primary/secondary/ghost/danger variants and a loading state.
 * Works as a submit button inside forms.
 * @tag bk-button
 * @slot - Button label.
 * @slot prefix - Content before the label (e.g. an icon).
 * @slot suffix - Content after the label.
 * @csspart base - The native button or link.
 * @csspart label - The label wrapper.
 * @fires click - Native click (suppressed while disabled or loading).
 */
export class BkButton extends BitkitElement {
  static formAssociated = true;
  static override shadowRootOptions = { ...BitkitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    baseStyles,
    buttonStyles,
    css`
      :host {
        display: inline-block;
      }
      :host([block]) {
        display: block;
      }
    `,
  ];

  static override properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    type: { type: String },
    disabled: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    block: { type: Boolean, reflect: true },
    href: { type: String },
    target: { type: String },
    label: { type: String },
  };

  declare variant: ButtonVariant;
  declare size: ButtonSize;
  /** `button`, `submit` or `reset` (submits the closest form). */
  declare type: 'button' | 'submit' | 'reset';
  declare disabled: boolean;
  /** Show a spinner and block interaction. */
  declare loading: boolean;
  /** Stretch to the container width. */
  declare block: boolean;
  /** Render as a link. */
  declare href: string | undefined;
  declare target: string | undefined;
  /** Accessible label override (when the visible label is not descriptive). */
  declare label: string | undefined;

  #internals?: ElementInternals;

  constructor() {
    super();
    this.variant = 'primary';
    this.size = 'md';
    this.type = 'button';
    this.disabled = false;
    this.loading = false;
    this.block = false;
    if (typeof this.attachInternals === 'function') {
      try {
        this.#internals = this.attachInternals();
      } catch {
        /* not form-associated in this environment */
      }
    }
    this.addEventListener('click', this.#onHostClick, { capture: true });
  }

  #onHostClick = (e: Event) => {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const form = this.#internals?.form ?? this.closest('form');
    if (!form || this.href) return;
    if (this.type === 'submit') form.requestSubmit();
    else if (this.type === 'reset') form.reset();
  };

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('.btn')?.focus(options);
  }

  override click(): void {
    this.renderRoot.querySelector<HTMLElement>('.btn')?.click();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('loading')) this.toggleAttribute('aria-busy', this.loading);
  }

  override render() {
    const inactive = this.disabled || this.loading;
    const classes = `btn ${this.variant} ${this.size} ${this.loading ? 'loading' : ''}`;
    const content = html`<span class="content" part="label"
        ><slot name="prefix"></slot><slot></slot><slot name="suffix"></slot></span
      >${this.loading ? html`<bk-spinner></bk-spinner>` : nothing}`;
    if (this.href) {
      return html`<a
        class=${classes}
        part="base"
        href=${inactive ? nothing : this.href}
        target=${this.target ?? nothing}
        rel=${this.target === '_blank' ? 'noopener noreferrer' : nothing}
        aria-disabled=${inactive ? 'true' : 'false'}
        aria-label=${this.label ?? nothing}
        role=${inactive ? 'link' : nothing}
        tabindex=${inactive ? '-1' : nothing}
        >${content}</a
      >`;
    }
    return html`<button
      class=${classes}
      part="base"
      type="button"
      aria-disabled=${inactive ? 'true' : 'false'}
      aria-label=${this.label ?? nothing}
    >
      ${content}
    </button>`;
  }
}

define('bk-button', BkButton);

declare global {
  interface HTMLElementTagNameMap {
    'bk-button': BkButton;
  }
}
