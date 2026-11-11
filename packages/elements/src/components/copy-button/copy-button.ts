import { css, html } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { buttonStyles } from '../button/button.js';
import { iconSvg } from '../icon/icon.js';

/** Write text to the clipboard with a fallback for older browsers / insecure contexts. */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through to legacy path */
    }
  }
  if (typeof document === 'undefined') throw new Error('Clipboard unavailable');
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Copy command failed');
}

/**
 * @summary Copies a value to the clipboard and confirms visually and to screen readers.
 * @tag bk-copy-button
 * @csspart base - The native button.
 * @fires bk-copy - After a successful copy. Detail: `{ value: string }`.
 * @fires bk-copy-error - When copying fails. Detail: `{ error: unknown }`.
 */
export class BkCopyButton extends BitkitElement {
  static override shadowRootOptions = { ...BitkitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    baseStyles,
    buttonStyles,
    css`
      :host {
        display: inline-flex;
      }
      .icon-only {
        width: var(--bk-control-height-md);
        padding: 0;
      }
      .icon-only.sm {
        width: var(--bk-control-height-sm);
      }
      svg {
        width: 1.15rem;
        height: 1.15rem;
        flex: none;
      }
      .copied {
        color: var(--bk-color-success);
      }
    `,
  ];

  static override properties = {
    value: { type: String },
    label: { type: String },
    appearance: { type: String },
    variant: { type: String },
    size: { type: String },
    _copied: { state: true },
    _announce: { state: true },
  };

  /** Text to copy. */
  declare value: string;
  /** Visible/accessible label. Default "Copy". */
  declare label: string | undefined;
  /** `icon` (icon only) or `button` (icon + label). */
  declare appearance: 'icon' | 'button';
  declare variant: 'ghost' | 'secondary' | 'primary';
  declare size: 'sm' | 'md';
  declare _copied: boolean;
  declare _announce: string;

  #timer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.value = '';
    this.appearance = 'icon';
    this.variant = 'ghost';
    this.size = 'md';
    this._copied = false;
    this._announce = '';
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  /** Copy the value programmatically. */
  async copy(): Promise<boolean> {
    try {
      await copyText(this.value);
      this._copied = true;
      this._announce = this.t('copiedAnnouncement');
      this.emit('bk-copy', { value: this.value });
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this._copied = false;
        this._announce = '';
      }, 2000);
      return true;
    } catch (error) {
      this._announce = this.t('copyFailed');
      this.emit('bk-copy-error', { error });
      return false;
    }
  }

  override render() {
    const label = this._copied ? this.t('copied') : (this.label ?? this.t('copy'));
    const iconOnly = this.appearance === 'icon';
    return html`<button
        class="btn ${this.variant} ${this.size} ${iconOnly ? 'icon-only' : ''} ${this._copied ? 'copied' : ''}"
        part="base"
        type="button"
        aria-label=${label}
        title=${iconOnly ? label : ''}
        @click=${() => void this.copy()}
      >
        ${iconSvg(this._copied ? 'check' : 'copy')} ${iconOnly ? '' : html`<span>${label}</span>`}</button
      ><span class="sr-only" role="status">${this._announce}</span>`;
  }
}

define('bk-copy-button', BkCopyButton);

declare global {
  interface HTMLElementTagNameMap {
    'bk-copy-button': BkCopyButton;
  }
}
