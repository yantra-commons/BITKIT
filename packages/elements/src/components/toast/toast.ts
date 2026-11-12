import { css, html, nothing } from 'lit';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg, type IconName } from '../icon/icon.js';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

const ICON: Record<ToastVariant, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert-circle',
  danger: 'alert-circle',
};

/**
 * @summary A notification message. Usually created with the `toast()` helper, which places it
 * in a shared live region. Auto-dismiss pauses while hovered or focused.
 * @tag ou-toast
 * @slot - Message content.
 * @csspart base - The toast container.
 * @fires ou-close - When the toast is dismissed.
 */
export class OuToast extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
        pointer-events: auto;
      }
      .t {
        display: flex;
        align-items: flex-start;
        gap: var(--ou-space-3);
        min-width: min(20rem, calc(100vw - 2rem));
        max-width: 28rem;
        padding: var(--ou-space-3) var(--ou-space-3) var(--ou-space-3) var(--ou-space-4);
        border: 1px solid var(--ou-color-border);
        border-inline-start: 4px solid var(--ou-toast-accent, var(--ou-color-info));
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-surface);
        box-shadow: var(--ou-shadow-md);
        font-size: var(--ou-font-size-sm);
        animation: in var(--ou-duration-normal) var(--ou-easing-standard);
      }
      .success {
        --ou-toast-accent: var(--ou-color-success);
      }
      .warning {
        --ou-toast-accent: var(--ou-color-warning);
      }
      .danger {
        --ou-toast-accent: var(--ou-color-danger);
      }
      .icon {
        flex: none;
        width: 1.25rem;
        height: 1.25rem;
        color: var(--ou-toast-accent, var(--ou-color-info));
      }
      .msg {
        flex: 1;
        padding-top: 1px;
      }
      button {
        flex: none;
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border: 0;
        border-radius: var(--ou-radius-sm);
        background: transparent;
        color: var(--ou-color-text-muted);
        cursor: pointer;
      }
      button:hover {
        background: var(--ou-color-surface-2);
      }
      svg {
        width: 1.1rem;
        height: 1.1rem;
      }
      .icon svg {
        width: 100%;
        height: 100%;
      }
      @keyframes in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ];

  static override properties = {
    variant: { type: String, reflect: true },
    duration: { type: Number },
    closable: { type: Boolean },
  };

  declare variant: ToastVariant;
  /** Auto-dismiss after ms (0 = stay). Default 5000. */
  declare duration: number;
  /** Show a dismiss button. Default true. */
  declare closable: boolean;

  #timer?: ReturnType<typeof setTimeout>;
  #remaining = 0;
  #started = 0;

  constructor() {
    super();
    this.variant = 'info';
    this.duration = 5000;
    this.closable = true;
    this.addEventListener('mouseenter', () => this.#pause());
    this.addEventListener('mouseleave', () => this.#resume());
    this.addEventListener('focusin', () => this.#pause());
    this.addEventListener('focusout', () => this.#resume());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Errors interrupt (role=alert); everything else is polite.
    this.setAttribute('role', this.variant === 'danger' ? 'alert' : 'status');
    this.#remaining = this.duration;
    this.#resume();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  #pause() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#remaining -= Date.now() - this.#started;
  }

  #resume() {
    if (this.duration <= 0 || this.#timer) return;
    this.#started = Date.now();
    this.#timer = setTimeout(() => this.dismiss(), Math.max(0, this.#remaining));
  }

  /** Remove the toast. */
  dismiss(): void {
    clearTimeout(this.#timer);
    this.emit('ou-close');
    this.remove();
  }

  override render() {
    return html`<div class="t ${this.variant}" part="base">
      <span class="icon">${iconSvg(ICON[this.variant])}</span>
      <div class="msg"><slot></slot></div>
      ${
        this.closable
          ? html`<button
              type="button"
              aria-label=${this.t('dismiss')}
              @click=${() => this.dismiss()}
            >
              ${iconSvg('cross')}
            </button>`
          : nothing
      }
    </div>`;
  }
}

/**
 * @summary Fixed region that stacks toasts. Created automatically by `toast()`.
 * @tag ou-toaster
 */
export class OuToaster extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        position: fixed;
        z-index: var(--ou-z-toast);
        inset-inline-end: var(--ou-space-4);
        inset-block-end: var(--ou-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-2);
        pointer-events: none;
      }
      @media (max-width: 480px) {
        :host {
          inset-inline: var(--ou-space-2);
        }
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
  closable?: boolean;
}

/** Show a toast message. Returns the toast element. No-op (returns null) during SSR. */
export function toast(message: string, options: ToastOptions = {}): OuToast | null {
  if (typeof document === 'undefined') return null;
  let region = document.querySelector('ou-toaster');
  if (!region) {
    region = document.createElement('ou-toaster');
    document.body.append(region);
  }
  const el = document.createElement('ou-toast');
  el.textContent = message;
  if (options.variant) el.variant = options.variant;
  if (options.duration !== undefined) el.duration = options.duration;
  if (options.closable !== undefined) el.closable = options.closable;
  region.append(el);
  return el;
}

define('ou-toast', OuToast);
define('ou-toaster', OuToaster);

declare global {
  interface HTMLElementTagNameMap {
    'ou-toast': OuToast;
    'ou-toaster': OuToaster;
  }
}
