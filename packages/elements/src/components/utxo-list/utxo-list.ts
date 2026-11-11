import { css, html, nothing } from 'lit';
import { formatAmount, MSAT_PER_SAT, truncateMiddle } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { bigintConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

export interface Utxo {
  txid: string;
  vout: number;
  /** Sats. */
  value: bigint | number | string;
  confirmations?: number;
  address?: string;
  label?: string;
  /** Frozen coins cannot be selected. */
  frozen?: boolean;
}

export const outpoint = (u: Pick<Utxo, 'txid' | 'vout'>) => `${u.txid}:${u.vout}`;

type SortKey = 'value' | 'confirmations';

/**
 * @summary Coin control: a sortable table of UTXOs with checkboxes, select all/none, and the
 * selected total compared to an optional target amount.
 * @tag bk-utxo-list
 * @csspart base - Container.
 * @csspart table - The table.
 * @csspart summary - Selected-total line.
 * @fires bk-change - Detail: `{ selected: string[] (outpoints), total: bigint }`.
 */
export class BkUtxoList extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: var(--bk-space-2);
        margin-bottom: var(--bk-space-2);
        font-size: var(--bk-font-size-sm);
      }
      .ok {
        color: var(--bk-color-success);
      }
      .short {
        color: var(--bk-color-warning);
      }
      .links button {
        border: 0;
        background: none;
        color: var(--bk-color-accent-text);
        font: inherit;
        font-weight: var(--bk-font-weight-semibold);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: var(--bk-radius-sm);
      }
      .scroll {
        overflow-x: auto;
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-md);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--bk-font-size-sm);
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        padding: var(--bk-space-2) var(--bk-space-3);
        text-align: start;
        white-space: nowrap;
      }
      th {
        font-size: var(--bk-font-size-xs);
        color: var(--bk-color-text-muted);
        background: var(--bk-color-surface-2);
      }
      th button {
        all: unset;
        cursor: pointer;
        border-radius: var(--bk-radius-sm);
      }
      th button:focus-visible {
        box-shadow: var(--bk-focus-ring);
      }
      td.num,
      th.num {
        text-align: end;
      }
      tr + tr td {
        border-top: 1px solid var(--bk-color-border);
      }
      tr.frozen {
        color: var(--bk-color-text-muted);
      }
      .mono {
        font-family: var(--bk-font-mono);
      }
      input[type='checkbox'] {
        accent-color: var(--bk-color-accent);
        width: 1rem;
        height: 1rem;
      }
    `,
  ];

  static override properties = {
    utxos: { attribute: false },
    selected: { attribute: false },
    target: { converter: bigintConverter },
    sortBy: { type: String, attribute: 'sort-by' },
    sortDir: { type: String, attribute: 'sort-dir' },
    locale: { type: String },
  };

  declare utxos: Utxo[];
  /** Selected outpoints (`txid:vout`). */
  declare selected: string[];
  /** Amount (sats) the selection should cover. */
  declare target: bigint | undefined;
  declare sortBy: SortKey;
  declare sortDir: 'asc' | 'desc';
  declare locale: string | undefined;

  constructor() {
    super();
    this.utxos = [];
    this.selected = [];
    this.sortBy = 'value';
    this.sortDir = 'desc';
  }

  /** Sum of the selected UTXO values in sats. */
  get total(): bigint {
    const set = new Set(this.selected);
    return this.utxos
      .filter((u) => set.has(outpoint(u)))
      .reduce((a, u) => a + (toBigint(u.value) ?? 0n), 0n);
  }

  #change(next: string[]) {
    this.selected = next;
    this.emit('bk-change', { selected: next, total: this.total });
  }

  #toggle(u: Utxo) {
    const op = outpoint(u);
    this.#change(
      this.selected.includes(op) ? this.selected.filter((s) => s !== op) : [...this.selected, op],
    );
  }

  #sort(key: SortKey) {
    if (this.sortBy === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortBy = key;
      this.sortDir = 'desc';
    }
  }

  #sorted(): Utxo[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...this.utxos].sort((a, b) => {
      if (this.sortBy === 'confirmations')
        return ((a.confirmations ?? 0) - (b.confirmations ?? 0)) * dir;
      const av = toBigint(a.value) ?? 0n;
      const bv = toBigint(b.value) ?? 0n;
      return (av === bv ? 0 : av > bv ? 1 : -1) * dir;
    });
  }

  override render() {
    const locale = this.localeFor(this.locale);
    const fmt = (s: bigint) => formatAmount(s * MSAT_PER_SAT, { unit: 'sats', locale }).text;
    const total = this.total;
    const target = toBigint(this.target);
    const selectable = this.utxos.filter((u) => !u.frozen).map(outpoint);
    const aria = (k: SortKey) =>
      this.sortBy === k ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = (k: SortKey) => (this.sortBy === k ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : '');
    return html`<div part="base">
      <div class="bar">
        <span part="summary" aria-live="polite"
          >${this.selected.length} selected · ${fmt(total)}
          ${
            target !== undefined
              ? html`<span class=${total >= target ? 'ok' : 'short'}
                  >${total >= target ? '· covers the amount' : `· ${fmt(target - total)} short`}</span
                >`
              : nothing
          }</span
        >
        <span class="links">
          <button type="button" @click=${() => this.#change(selectable)}>Select all</button>
          <button type="button" @click=${() => this.#change([])}>Clear</button>
        </span>
      </div>
      <div class="scroll">
        <table part="table">
          <caption class="sr-only">
            Unspent coins
          </caption>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Select</span></th>
              <th scope="col">Coin</th>
              <th scope="col" class="num" aria-sort=${aria('confirmations')}>
                <button type="button" @click=${() => this.#sort('confirmations')}>
                  Confirmations${arrow('confirmations')}
                </button>
              </th>
              <th scope="col" class="num" aria-sort=${aria('value')}>
                <button type="button" @click=${() => this.#sort('value')}>
                  Amount${arrow('value')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            ${this.#sorted().map((u) => {
              const op = outpoint(u);
              const name = u.label ?? truncateMiddle(op, { start: 8, end: 4 });
              return html`<tr class=${u.frozen ? 'frozen' : ''}>
                <td>
                  <input
                    type="checkbox"
                    .checked=${this.selected.includes(op)}
                    ?disabled=${u.frozen}
                    aria-label="Use ${name} (${fmt(toBigint(u.value) ?? 0n)})${u.frozen ? ', frozen' : ''}"
                    @change=${() => this.#toggle(u)}
                  />
                </td>
                <td>
                  ${u.label ? html`<div>${u.label}</div>` : nothing}
                  <div class="mono" title=${op}>
                    ${truncateMiddle(op, { start: 8, end: 4 })}${u.frozen ? ' · frozen' : ''}
                  </div>
                </td>
                <td class="num">${u.confirmations ?? 0}</td>
                <td class="num">${fmt(toBigint(u.value) ?? 0n)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    </div>`;
  }
}

define('bk-utxo-list', BkUtxoList);

declare global {
  interface HTMLElementTagNameMap {
    'bk-utxo-list': BkUtxoList;
  }
}
