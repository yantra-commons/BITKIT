import { css, html, nothing } from 'lit';
import { backupCheckChoices, pickBackupCheckIndices } from '@orange-ui/core/mnemonic';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../button/button.js';

/**
 * @summary SECURITY-SENSITIVE. "Verify your backup" flow: asks for randomly chosen words of the
 * recovery phrase as multiple choice. Words are set via the `words` property only and are
 * never emitted.
 * @tag ou-backup-check
 * @csspart base - Container.
 * @csspart question - Question text.
 * @csspart choice - Each answer button.
 * @fires ou-verified - All answers correct.
 * @fires ou-fail - A wrong answer. Detail: `{ position: number }` (1-based word number).
 */
export class OuBackupCheck extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .w {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-4);
      }
      .progress {
        margin: 0;
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-text-muted);
      }
      h3 {
        margin: 0;
        font-size: var(--ou-font-size-lg);
      }
      .choices {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ou-space-2);
      }
      .choice {
        min-height: var(--ou-control-height-lg);
        border: 1px solid var(--ou-color-border-strong);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-surface);
        color: inherit;
        font: inherit;
        font-family: var(--ou-font-mono);
        cursor: pointer;
      }
      .choice:hover {
        background: var(--ou-color-surface-2);
      }
      .msg {
        display: flex;
        gap: var(--ou-space-2);
        align-items: center;
        margin: 0;
        font-size: var(--ou-font-size-sm);
      }
      .msg svg {
        width: 1.1rem;
        height: 1.1rem;
        flex: none;
      }
      .bad {
        color: var(--ou-color-danger);
      }
      .done {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ou-space-2);
        padding: var(--ou-space-6) 0;
        text-align: center;
      }
      .done .icon {
        display: grid;
        place-items: center;
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 50%;
        background: var(--ou-color-success-bg);
        color: var(--ou-color-success);
      }
      .done svg {
        width: 60%;
        height: 60%;
      }
    `,
  ];

  static override properties = {
    words: { attribute: false },
    count: { type: Number },
    choicesPerQuestion: { type: Number, attribute: 'choices' },
    random: { attribute: false },
    _indices: { state: true },
    _step: { state: true },
    _choices: { state: true },
    _wrong: { state: true },
    _done: { state: true },
  };

  /** Recovery words (property only). */
  declare words: string[];
  /** How many words to ask for. Default 3. */
  declare count: number;
  /** Answers per question. Default 4. */
  declare choicesPerQuestion: number;
  /** Injectable random source (max) => int, for tests. Defaults to crypto randomness. */
  declare random: ((max: number) => number) | undefined;
  declare _indices: number[];
  declare _step: number;
  declare _choices: string[];
  declare _wrong: boolean;
  declare _done: boolean;

  constructor() {
    super();
    this.words = [];
    this.count = 3;
    this.choicesPerQuestion = 4;
    this._indices = [];
    this._step = 0;
    this._choices = [];
    this._wrong = false;
    this._done = false;
  }

  /** (Re)start the check with new random positions. */
  restart(): void {
    if (!this.words.length) return;
    const n = Math.min(this.count, this.words.length);
    this._indices = pickBackupCheckIndices(this.words.length, n, this.random);
    this._step = 0;
    this._done = false;
    this._wrong = false;
    this.#prepare();
  }

  #prepare() {
    const idx = this._indices[this._step];
    if (idx === undefined) return;
    this._choices = backupCheckChoices(this.words[idx]!, this.choicesPerQuestion, this.random);
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('words') || changed.has('count')) this.restart();
  }

  #answer(word: string) {
    const idx = this._indices[this._step]!;
    if (word === this.words[idx]) {
      this._wrong = false;
      if (this._step + 1 >= this._indices.length) {
        this._done = true;
        this.emit('ou-verified');
      } else {
        this._step += 1;
        this.#prepare();
      }
    } else {
      this._wrong = true;
      this.emit('ou-fail', { position: idx + 1 });
      this.#prepare();
    }
  }

  override render() {
    if (!this.words.length) return html`<div part="base"></div>`;
    if (this._done) {
      return html`<div class="done" part="base" role="status">
        <span class="icon">${iconSvg('check')}</span>
        <h3>Backup verified</h3>
        <p class="progress">Keep your recovery phrase somewhere safe and offline.</p>
      </div>`;
    }
    const idx = this._indices[this._step] ?? 0;
    return html`<div class="w" part="base" data-sensitive>
      <p class="progress">Question ${this._step + 1} of ${this._indices.length}</p>
      <h3 part="question" id="q">Which is word #${idx + 1}?</h3>
      <div class="choices" role="group" aria-labelledby="q">
        ${this._choices.map((c) => html`<button class="choice" part="choice" type="button" @click=${() => this.#answer(c)}>${c}</button>`)}
      </div>
      <div aria-live="assertive">
        ${
          this._wrong
            ? html`<p class="msg bad">
                ${iconSvg('alert-circle')}That's not right. Check your written backup and try again.
              </p>`
            : nothing
        }
      </div>
    </div>`;
  }
}

define('ou-backup-check', OuBackupCheck);

declare global {
  interface HTMLElementTagNameMap {
    'ou-backup-check': OuBackupCheck;
  }
}
