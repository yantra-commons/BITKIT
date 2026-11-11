import { css, html, nothing } from 'lit';
import { BitkitElement } from '../../internal/base.js';
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
 * @tag bk-toast
 * @slot - Message content.
 * @csspart base - The toast container.
 * @fires bk-close - When the toast is dismissed.
 */
export class BkToast extends BitkitElement {
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
        gap: var(--bk-space-3);
        min-width: min(20rem, calc(100vw - 2rem));
        max-width: 28rem;
        padding: var(--bk-space-3) var(--bk-space-3) var(--bk-space-3) var(--bk-space-4);
        border: 1px solid var(--bk-color-border);
        border-inline-start: 4px solid var(--bk-toast-accent, var(--bk-color-info));
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-surface);
        box-shadow: var(--bk-shadow-md);
        font-size: var(--bk-font-size-sm);
        animation: in var(--bk-duration-normal) var(--bk-easing-standard);
      }
      .success {
        --bk-toast-accent: var(--bk-color-success);
      }
      .warning {
        --bk-toast-accent: var(--bk-color-warning);
      }
      .danger {
        --bk-toast-accent: var(--bk-color-danger);
      }
      .icon {
        flex: none;
        width: 1.25rem;
        height: 1.25rem;
        color: var(--bk-toast-accent, var(--bk-color-info));
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
        border-radius: var(--bk-radius-sm);
        background: transparent;
        color: var(--bk-color-text-muted);
        cursor: pointer;
      }
      button:hover {
        background: var(--bk-color-surface-2);
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
    this.emit('bk-close');
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
 * @tag bk-toaster
 */
export class BkToaster extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        position: fixed;
        z-index: var(--bk-z-toast);
        inset-inline-end: var(--bk-space-4);
        inset-block-end: var(--bk-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-2);
        pointer-events: none;
      }
      @media (max-width: 480px) {
        :host {
          inset-inline: var(--bk-space-2);
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
export function toast(message: string, options: ToastOptions = {}): BkToast | null {
  if (typeof document === 'undefined') return null;
  let region = document.querySelector('bk-toaster');
  if (!region) {
    region = document.createElement('bk-toaster');
    document.body.append(region);
  }
  const el = document.createElement('bk-toast');
  el.textContent = message;
  if (options.variant) el.variant = options.variant;
  if (options.duration !== undefined) el.duration = options.duration;
  if (options.closable !== undefined) el.closable = options.closable;
  region.append(el);
  return el;
}

define('bk-toast', BkToast);
define('bk-toaster', BkToaster);

declare global {
  interface HTMLElementTagNameMap {
    'bk-toast': BkToast;
    'bk-toaster': BkToaster;
  }
}
