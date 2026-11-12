import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import {
  checkMnemonic,
  isBip39Word,
  splitMnemonic,
  suggestWords,
  VALID_WORD_COUNTS,
} from '@orange-ui/core/mnemonic';
import { OrangeElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';

export interface MnemonicInputDetail {
  /** Phrase has a valid length, known words and a valid checksum. */
  valid: boolean;
  /** Every field is filled. */
  complete: boolean;
  wordCount: number;
  invalidWordIndices: number[];
}

/**
 * @summary SECURITY-SENSITIVE. Word-by-word recovery phrase entry with BIP39 autocomplete and
 * checksum validation. Words live only in this component's memory: they are never stored,
 * never sent, never placed in events. Read them with `getMnemonic()` once valid, then `clear()`.
 * Browser autocomplete, spellcheck and password managers are disabled on every field.
 * @tag ou-mnemonic-input
 * @csspart base - Container.
 * @csspart grid - Word grid.
 * @csspart field - Each word field.
 * @csspart suggestions - Suggestion list.
 * @csspart status - Validation message.
 * @fires ou-change - Detail: `MnemonicInputDetail` (never includes the words).
 */
export class OuMnemonicInput extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--ou-space-2);
        margin-bottom: var(--ou-space-3);
      }
      .top label {
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-medium);
      }
      select {
        margin-inline-start: var(--ou-space-2);
        padding: var(--ou-space-1) var(--ou-space-2);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-sm);
        background: var(--ou-color-surface);
        color: inherit;
        font: inherit;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--ou-mnemonic-columns, 3), minmax(0, 1fr));
        gap: var(--ou-space-2);
      }
      @media (max-width: 420px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .f {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--ou-space-1);
        padding-inline-start: var(--ou-space-2);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-sm);
        background: var(--ou-color-surface);
      }
      .f:focus-within {
        border-color: var(--ou-color-focus);
        box-shadow: 0 0 0 1px var(--ou-color-focus);
      }
      .f.bad {
        border-color: var(--ou-color-danger);
      }
      .n {
        min-width: 1.5em;
        font-size: var(--ou-font-size-xs);
        color: var(--ou-color-text-muted);
        text-align: end;
      }
      input {
        flex: 1;
        min-width: 0;
        min-height: var(--ou-control-height-md);
        padding: 0 var(--ou-space-1);
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-family: var(--ou-font-mono);
      }
      input:focus,
      input:focus-visible {
        outline: none;
        box-shadow: none;
      }
      .masked input {
        -webkit-text-security: disc;
      }
      ul {
        position: absolute;
        z-index: 10;
        top: calc(100% + 2px);
        inset-inline: 0;
        margin: 0;
        padding: var(--ou-space-1);
        list-style: none;
        border: 1px solid var(--ou-color-border);
        border-radius: var(--ou-radius-sm);
        background: var(--ou-color-surface);
        box-shadow: var(--ou-shadow-md);
      }
      li {
        padding: var(--ou-space-1) var(--ou-space-2);
        border-radius: var(--ou-radius-sm);
        font-family: var(--ou-font-mono);
        cursor: pointer;
      }
      li[aria-selected='true'] {
        background: var(--ou-color-accent);
        color: var(--ou-color-on-accent);
      }
      .status {
        display: flex;
        align-items: center;
        gap: var(--ou-space-1);
        min-height: 1.5rem;
        margin-top: var(--ou-space-3);
        font-size: var(--ou-font-size-sm);
      }
      .status svg {
        width: 1rem;
        height: 1rem;
        flex: none;
      }
      .ok {
        color: var(--ou-color-success);
      }
      .err {
        color: var(--ou-color-danger);
      }
    `,
  ];

  static override properties = {
    wordCount: { type: Number, attribute: 'word-count' },
    allowedCounts: { attribute: false },
    columns: { type: Number },
    masked: { type: Boolean },
    label: { type: String },
    _words: { state: true },
    _active: { state: true },
    _highlight: { state: true },
    _touched: { state: true },
  };

  /** Number of words. Default 12. */
  declare wordCount: number;
  /** Lengths offered in the selector; empty array hides it. Default [12, 24]. */
  declare allowedCounts: number[];
  declare columns: number;
  /** Mask the characters while typing. */
  declare masked: boolean;
  declare label: string;
  declare _words: string[];
  declare _active: number;
  declare _highlight: number;
  declare _touched: Set<number>;

  #id = nextId('mn');

  constructor() {
    super();
    this.wordCount = 12;
    this.allowedCounts = [12, 24];
    this.columns = 3;
    this.masked = false;
    this.label = 'Recovery phrase';
    this._words = [];
    this._active = -1;
    this._highlight = 0;
    this._touched = new Set();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('wordCount')) {
      const n = (VALID_WORD_COUNTS as readonly number[]).includes(this.wordCount)
        ? this.wordCount
        : 12;
      this._words = Array.from({ length: n }, (_, i) => this._words[i] ?? '');
    }
  }

  /** The phrase as a single string, or null unless it is complete and valid. */
  getMnemonic(): string | null {
    const r = checkMnemonic(this._words);
    return r.valid ? this._words.map((w) => w.trim().toLowerCase()).join(' ') : null;
  }

  /** Erase every entered word. */
  clear(): void {
    this._words.fill('');
    this._words = Array.from({ length: this._words.length }, () => '');
    this._touched = new Set();
    this.renderRoot.querySelectorAll('input').forEach((i) => (i.value = ''));
    this.#emit();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._words.fill('');
  }

  #detail(): MnemonicInputDetail {
    const complete = this._words.every((w) => w.trim());
    const r = checkMnemonic(this._words);
    return {
      valid: r.valid,
      complete,
      wordCount: this._words.length,
      invalidWordIndices: r.invalidWordIndices.filter((i) => this._words[i]!.trim()),
    };
  }

  #emit() {
    this.emit<MnemonicInputDetail>('ou-change', this.#detail());
  }

  #set(i: number, value: string) {
    const next = [...this._words];
    next[i] = value.trim().toLowerCase();
    this._words = next;
    this._highlight = 0;
    this.#emit();
  }

  #focus(i: number) {
    const el = this.renderRoot.querySelector<HTMLInputElement>(`#${this.#id}-${i}`);
    el?.focus();
  }

  #onInput(i: number, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const parts = splitMnemonic(raw);
    if (parts.length > 1) {
      // Pasted (or typed) several words: spread them across fields from here.
      const next = [...this._words];
      parts.forEach((w, k) => {
        if (i + k < next.length) next[i + k] = w;
      });
      this._words = next;
      parts.forEach((_, k) => this._touched.add(i + k));
      this.#emit();
      void this.updateComplete.then(() => this.#focus(Math.min(i + parts.length, next.length - 1)));
      return;
    }
    this.#set(i, raw.replace(/\s/g, ''));
    // Auto-advance once the prefix identifies exactly one word and is complete.
    const v = this._words[i]!;
    const s = suggestWords(v, 2);
    if (v.length >= 3 && s.length === 1 && s[0] === v && i < this._words.length - 1) {
      this._touched.add(i);
      void this.updateComplete.then(() => this.#focus(i + 1));
    }
  }

  #accept(i: number, word: string) {
    this.#set(i, word);
    this._touched.add(i);
    if (i < this._words.length - 1) void this.updateComplete.then(() => this.#focus(i + 1));
  }

  #onKeydown(i: number, e: KeyboardEvent) {
    const sugg = this.#suggestions(i);
    if (e.key === 'ArrowDown' && sugg.length) {
      e.preventDefault();
      this._highlight = (this._highlight + 1) % sugg.length;
    } else if (e.key === 'ArrowUp' && sugg.length) {
      e.preventDefault();
      this._highlight = (this._highlight - 1 + sugg.length) % sugg.length;
    } else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && sugg.length) {
      e.preventDefault();
      this.#accept(i, sugg[this._highlight] ?? sugg[0]!);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._touched.add(i);
      if (i < this._words.length - 1) this.#focus(i + 1);
    } else if (e.key === 'Backspace' && !this._words[i] && i > 0) {
      e.preventDefault();
      this.#focus(i - 1);
    } else if (e.key === 'Escape') {
      this._active = -1;
    }
  }

  #suggestions(i: number): string[] {
    const v = this._words[i] ?? '';
    if (i !== this._active || !v || isBip39Word(v)) return [];
    return suggestWords(v, 5);
  }

  #onCount(e: Event) {
    this.wordCount = Number((e.target as HTMLSelectElement).value);
    this.#emit();
  }

  override render() {
    const d = this.#detail();
    const bad = new Set(
      d.invalidWordIndices.filter((i) => this._touched.has(i) || i !== this._active),
    );
    let status;
    if (d.invalidWordIndices.length) {
      status = html`<span class="err"
        >${iconSvg('alert-circle')} Word ${d.invalidWordIndices.map((i) => i + 1).join(', ')}
        ${d.invalidWordIndices.length === 1 ? 'is' : 'are'} not in the word list.</span
      >`;
    } else if (d.complete && !d.valid) {
      status = html`<span class="err"
        >${iconSvg('alert-circle')} These words are valid, but the phrase is not. Check the order
        and spelling.</span
      >`;
    } else if (d.valid) {
      status = html`<span class="ok">${iconSvg('check')} Valid recovery phrase</span>`;
    }
    return html`<div part="base" class=${this.masked ? 'masked' : ''} data-sensitive>
      <div class="top">
        <span id="${this.#id}-label" class="label" style="font-weight:600">${this.label}</span>
        ${
          this.allowedCounts.length > 1
            ? html`<label
                >Words
                <select .value=${live(String(this._words.length))} @change=${this.#onCount}>
                  ${this.allowedCounts.map((n) => html`<option value=${n} ?selected=${n === this._words.length}>${n}</option>`)}
                </select></label
              >`
            : nothing
        }
      </div>
      <div
        class="grid"
        part="grid"
        role="group"
        aria-labelledby="${this.#id}-label"
        style="--ou-mnemonic-columns:${this.columns}"
      >
        ${this._words.map((w, i) => {
          const sugg = this.#suggestions(i);
          const listId = `${this.#id}-list-${i}`;
          return html`<div class="f ${bad.has(i) ? 'bad' : ''}" part="field">
            <span class="n" aria-hidden="true">${i + 1}</span>
            <input
              id="${this.#id}-${i}"
              .value=${live(w)}
              aria-label="Word ${i + 1}"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded=${sugg.length ? 'true' : 'false'}
              aria-controls=${listId}
              aria-activedescendant=${sugg.length ? `${listId}-${this._highlight}` : nothing}
              aria-invalid=${bad.has(i) ? 'true' : 'false'}
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              @input=${(e: Event) => this.#onInput(i, e)}
              @keydown=${(e: KeyboardEvent) => this.#onKeydown(i, e)}
              @focus=${() => {
                this._active = i;
                this._highlight = 0;
              }}
              @blur=${() => {
                this._touched.add(i);
                if (this._active === i) this._active = -1;
              }}
            />
            <ul
              id=${listId}
              role="listbox"
              part="suggestions"
              aria-label="Suggestions"
              ?hidden=${!sugg.length}
            >
              ${sugg.map(
                (s, k) =>
                  html`<li
                    id="${listId}-${k}"
                    role="option"
                    aria-selected=${k === this._highlight ? 'true' : 'false'}
                    @mousedown=${(e: Event) => {
                      e.preventDefault();
                      this.#accept(i, s);
                    }}
                  >
                    ${s}
                  </li>`,
              )}
            </ul>
          </div>`;
        })}
      </div>
      <div class="status" part="status" aria-live="polite">${status ?? nothing}</div>
    </div>`;
  }
}

define('ou-mnemonic-input', OuMnemonicInput);

declare global {
  interface HTMLElementTagNameMap {
    'ou-mnemonic-input': OuMnemonicInput;
  }
}
