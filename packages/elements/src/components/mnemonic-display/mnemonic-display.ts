import { css, html, nothing } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../button/button.js';

/**
 * @summary SECURITY-SENSITIVE. Shows a recovery phrase on demand. Words are set via the `words`
 * property only (never an attribute), are not rendered into the DOM while hidden, cannot be
 * copied unless `allow-copy` is set, and are hidden automatically when the page is hidden.
 * Nothing is stored or sent anywhere. Call `clear()` when done.
 * @tag bk-mnemonic-display
 * @slot warning - Replace the default warning text.
 * @csspart base - Container.
 * @csspart warning - Warning box.
 * @csspart words - Word grid.
 * @csspart word - Each word.
 * @fires bk-reveal - When the phrase is shown.
 * @fires bk-hide - When the phrase is hidden.
 */
export class BkMnemonicDisplay extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .w {
        display: flex;
        flex-direction: column;
        gap: var(--bk-space-4);
      }
      .warning {
        display: flex;
        gap: var(--bk-space-3);
        padding: var(--bk-space-3) var(--bk-space-4);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-warning-bg);
        color: var(--bk-color-text);
        font-size: var(--bk-font-size-sm);
      }
      .warning svg {
        flex: none;
        width: 1.25rem;
        height: 1.25rem;
        color: var(--bk-color-warning);
      }
      .warning p {
        margin: 0;
      }
      .stage {
        position: relative;
      }
      ol {
        display: grid;
        grid-template-columns: repeat(var(--bk-mnemonic-columns, 3), minmax(0, 1fr));
        gap: var(--bk-space-2);
        margin: 0;
        padding: 0;
        list-style: none;
        counter-reset: w;
      }
      @media (max-width: 420px) {
        ol {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      li {
        display: flex;
        align-items: baseline;
        gap: var(--bk-space-2);
        padding: var(--bk-space-2) var(--bk-space-3);
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-sm);
        background: var(--bk-color-surface);
        font-family: var(--bk-font-mono);
        font-size: var(--bk-font-size-md);
      }
      .n {
        min-width: 1.5em;
        font-size: var(--bk-font-size-xs);
        color: var(--bk-color-text-muted);
        text-align: end;
      }
      .no-copy {
        user-select: none;
        -webkit-user-select: none;
      }
      .hidden li {
        filter: blur(5px);
      }
      .cover {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
      }
      .actions {
        display: flex;
        gap: var(--bk-space-2);
        flex-wrap: wrap;
      }
    `,
  ];

  static override properties = {
    words: { attribute: false },
    revealed: { type: Boolean, reflect: true },
    allowCopy: { type: Boolean, attribute: 'allow-copy' },
    columns: { type: Number },
    autoHideMs: { type: Number, attribute: 'auto-hide-ms' },
  };

  /** The recovery words (property only). */
  declare words: string[];
  /** Whether the words are visible. */
  declare revealed: boolean;
  /** Allow selecting/copying the words. Default false (clipboards are readable by other apps). */
  declare allowCopy: boolean;
  /** Grid columns. Default 3. */
  declare columns: number;
  /** Hide again after this many ms (0 = never). Default 120000. */
  declare autoHideMs: number;

  #timer?: ReturnType<typeof setTimeout>;
  #onVisibility = () => {
    if (document.visibilityState === 'hidden') this.hide();
  };

  constructor() {
    super();
    this.words = [];
    this.revealed = false;
    this.allowCopy = false;
    this.columns = 3;
    this.autoHideMs = 120_000;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.#onVisibility);
    clearTimeout(this.#timer);
  }

  /** Show the words. */
  reveal(): void {
    this.revealed = true;
    this.emit('bk-reveal');
    clearTimeout(this.#timer);
    if (this.autoHideMs > 0) this.#timer = setTimeout(() => this.hide(), this.autoHideMs);
  }

  /** Hide the words. */
  hide(): void {
    if (!this.revealed) return;
    this.revealed = false;
    clearTimeout(this.#timer);
    this.emit('bk-hide');
  }

  /**
   * Drop references to the words. JavaScript strings are immutable, so this cannot zero memory,
   * but it removes every reference this component holds so they can be garbage-collected.
   */
  clear(): void {
    this.words.fill('');
    this.words = [];
    this.hide();
  }

  #blockCopy(e: Event) {
    if (!this.allowCopy) e.preventDefault();
  }

  override render() {
    const words = this.words ?? [];
    const visible = this.revealed && words.length > 0;
    return html`<div class="w" part="base" data-sensitive>
      <div class="warning" part="warning" role="note">
        ${iconSvg('alert-circle')}
        <slot name="warning"
          ><p>
            <strong>Write these ${words.length || ''} words down in order</strong> and keep them
            somewhere safe and offline. Anyone with these words can take your bitcoin. Never share
            them or type them into a website.
          </p></slot
        >
      </div>
      <div class="stage">
        <ol
          part="words"
          class="${visible ? '' : 'hidden'} ${this.allowCopy ? '' : 'no-copy'}"
          style="--bk-mnemonic-columns:${this.columns}"
          aria-label="Recovery phrase"
          aria-hidden=${visible ? 'false' : 'true'}
          @copy=${this.#blockCopy}
          @cut=${this.#blockCopy}
          @contextmenu=${this.#blockCopy}
        >
          ${words.map(
            (w, i) =>
              html`<li part="word">
                <span class="n" aria-hidden="true">${i + 1}</span
                ><span>${visible ? w : '•••••'}</span>
              </li>`,
          )}
        </ol>
        ${
          !visible && words.length
            ? html`<div class="cover">
                <bk-button variant="secondary" @click=${() => this.reveal()}
                  ><span slot="prefix" style="display:inline-flex;width:1.1em;height:1.1em"
                    >${iconSvg('visible')}</span
                  >Reveal recovery phrase</bk-button
                >
              </div>`
            : nothing
        }
      </div>
      ${
        visible
          ? html`<div class="actions">
              <bk-button variant="secondary" @click=${() => this.hide()}
                ><span slot="prefix" style="display:inline-flex;width:1.1em;height:1.1em"
                  >${iconSvg('hidden')}</span
                >Hide</bk-button
              >
            </div>`
          : nothing
      }
    </div>`;
  }
}

define('bk-mnemonic-display', BkMnemonicDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'bk-mnemonic-display': BkMnemonicDisplay;
  }
}
