import { css, html, nothing, type PropertyValues } from 'lit';
import { BitkitElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';

export type DialogCloseReason = 'close-button' | 'escape' | 'backdrop' | 'method';

/**
 * @summary Modal dialog built on the native `<dialog>` element: focus is trapped, the page is
 * inert, Escape closes, and focus returns to the opener on close.
 * @tag bk-dialog
 * @slot - Dialog body.
 * @slot footer - Actions area.
 * @csspart dialog - The native dialog.
 * @csspart header - Header with title and close button.
 * @csspart title - The title.
 * @csspart body - Scrollable body.
 * @csspart footer - Footer.
 * @fires bk-open - After the dialog opens.
 * @fires bk-request-close - Before closing; cancelable. Detail: `{ reason }`.
 * @fires bk-close - After the dialog closes. Detail: `{ reason }`.
 */
export class BkDialog extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: contents;
      }
      dialog {
        width: min(100% - 2 * var(--bk-space-4), var(--bk-dialog-width, 28rem));
        max-height: min(100% - 2 * var(--bk-space-4), 48rem);
        padding: 0;
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-lg);
        background: var(--bk-color-surface);
        color: var(--bk-color-text);
        box-shadow: var(--bk-shadow-lg);
        overflow: hidden;
        font-family: var(--bk-font-sans);
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
        animation: enter var(--bk-duration-normal) var(--bk-easing-standard);
      }
      dialog::backdrop {
        background: var(--bk-color-overlay);
      }
      .lg {
        --bk-dialog-width: 40rem;
      }
      .sm {
        --bk-dialog-width: 22rem;
      }
      header {
        display: flex;
        align-items: center;
        gap: var(--bk-space-2);
        padding: var(--bk-space-4) var(--bk-space-4) var(--bk-space-2) var(--bk-space-5);
      }
      h2 {
        flex: 1;
        margin: 0;
        font-size: var(--bk-font-size-lg);
        font-weight: var(--bk-font-weight-semibold);
      }
      .close {
        display: inline-grid;
        place-items: center;
        width: var(--bk-control-height-sm);
        height: var(--bk-control-height-sm);
        border: 0;
        border-radius: var(--bk-radius-sm);
        background: transparent;
        color: var(--bk-color-text-muted);
        cursor: pointer;
      }
      .close:hover {
        background: var(--bk-color-surface-2);
        color: var(--bk-color-text);
      }
      .close svg {
        width: 1.25rem;
        height: 1.25rem;
      }
      .body {
        padding: var(--bk-space-2) var(--bk-space-5) var(--bk-space-5);
        overflow: auto;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--bk-space-2);
        padding: var(--bk-space-3) var(--bk-space-5) var(--bk-space-5);
      }
      footer.empty {
        display: none;
      }
      @keyframes enter {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }
      @media (max-width: 480px) {
        dialog {
          margin-block-end: 0;
          width: 100%;
          max-width: 100%;
          border-end-start-radius: 0;
          border-end-end-radius: 0;
        }
      }
    `,
  ];

  static override properties = {
    open: { type: Boolean, reflect: true },
    label: { type: String },
    size: { type: String },
    closeOnBackdrop: { type: Boolean, attribute: 'close-on-backdrop' },
    hideClose: { type: Boolean, attribute: 'hide-close' },
    _hasFooter: { state: true },
  };

  /** Whether the dialog is open. */
  declare open: boolean;
  /** Dialog title (also its accessible name). */
  declare label: string;
  declare size: 'sm' | 'md' | 'lg';
  /** Close when clicking the backdrop. Default true. */
  declare closeOnBackdrop: boolean;
  /** Hide the close button (Escape still closes unless prevented). */
  declare hideClose: boolean;
  declare _hasFooter: boolean;

  #titleId = nextId('dlg-title');
  #opener: Element | null = null;
  #reason: DialogCloseReason = 'method';

  constructor() {
    super();
    this.open = false;
    this.label = '';
    this.size = 'md';
    this.closeOnBackdrop = true;
    this.hideClose = false;
    this._hasFooter = false;
  }

  protected override willUpdate(): void {
    this._hasFooter = Boolean(this.querySelector(':scope > [slot="footer"]'));
  }

  get dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector('dialog');
  }

  /** Open the dialog. */
  show(): void {
    this.open = true;
  }

  /** Close the dialog (fires bk-request-close first). */
  hide(reason: DialogCloseReason = 'method'): void {
    this.#requestClose(reason);
  }

  #requestClose(reason: DialogCloseReason) {
    if (!this.open) return;
    if (!this.emit('bk-request-close', { reason }, { cancelable: true })) return;
    this.#reason = reason;
    this.open = false;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    const dlg = this.dialog;
    if (!dlg) return;
    if (this.open && !dlg.open) {
      this.#opener = (document.activeElement as Element | null) ?? null;
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      this.emit('bk-open');
    } else if (!this.open && (dlg.open || dlg.hasAttribute('open'))) {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
      this.emit('bk-close', { reason: this.#reason });
      this.#reason = 'method';
      const opener = this.#opener as HTMLElement | null;
      if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
    }
  }

  #onCancel(e: Event) {
    // Escape key: route through request-close so it can be prevented.
    e.preventDefault();
    this.#requestClose('escape');
  }

  #onClick(e: MouseEvent) {
    if (!this.closeOnBackdrop) return;
    if (e.target === this.dialog) {
      const r = this.dialog!.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) this.#requestClose('backdrop');
    }
  }

  #onFooterSlot() {
    this.requestUpdate();
  }

  override render() {
    return html`<dialog
      part="dialog"
      class=${this.size}
      aria-labelledby=${this.label ? this.#titleId : nothing}
      aria-label=${this.label ? nothing : 'Dialog'}
      @cancel=${this.#onCancel}
      @click=${this.#onClick}
    >
      <header part="header">
        <h2 id=${this.#titleId} part="title">${this.label}</h2>
        ${
          this.hideClose
            ? nothing
            : html`<button
                class="close"
                type="button"
                aria-label=${this.t('close')}
                @click=${() => this.#requestClose('close-button')}
              >
                ${iconSvg('cross')}
              </button>`
        }
      </header>
      <div class="body" part="body"><slot></slot></div>
      <footer part="footer" class=${this._hasFooter ? '' : 'empty'}>
        <slot name="footer" @slotchange=${this.#onFooterSlot}></slot>
      </footer>
    </dialog>`;
  }
}

define('bk-dialog', BkDialog);

declare global {
  interface HTMLElementTagNameMap {
    'bk-dialog': BkDialog;
  }
}
