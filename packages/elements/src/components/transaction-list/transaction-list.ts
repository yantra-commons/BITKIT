import { css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Network } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import type { TransactionData } from '../transaction-item/transaction-item.js';
import '../button/button.js';
import '../skeleton/skeleton.js';
import '../transaction-item/transaction-item.js';

/** Group label for a timestamp: Today, Yesterday, or a localized date. */
export function dateGroup(ts: number | undefined, locale: string, now = Date.now()): string {
  if (ts === undefined) return 'Pending';
  const d = new Date(ts);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date(now)) - start(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(locale, {
    year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * @summary Transaction history with date groups, loading skeletons, empty state and "load more".
 * @tag bk-transaction-list
 * @slot empty - Custom empty state.
 * @csspart base - Container.
 * @csspart group - Date group heading.
 * @csspart item - Each bk-transaction-item.
 * @fires bk-select - When a transaction is activated. Detail: `{ id }`.
 * @fires bk-load-more - When "Load more" is pressed.
 */
export class BkTransactionList extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      h3 {
        margin: var(--bk-space-4) 0 var(--bk-space-1);
        padding-inline: var(--bk-space-3);
        font-size: var(--bk-font-size-xs);
        font-weight: var(--bk-font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--bk-color-text-muted);
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li + li {
        border-top: 1px solid var(--bk-color-border);
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--bk-space-2);
        padding: var(--bk-space-8) var(--bk-space-4);
        color: var(--bk-color-text-muted);
        text-align: center;
      }
      .empty svg {
        width: 2rem;
        height: 2rem;
      }
      .sk {
        display: flex;
        gap: var(--bk-space-3);
        align-items: center;
        padding: var(--bk-space-3);
      }
      .sk div {
        flex: 1;
        display: grid;
        gap: var(--bk-space-1);
      }
      .more {
        display: flex;
        justify-content: center;
        padding: var(--bk-space-3);
      }
    `,
  ];

  static override properties = {
    transactions: { attribute: false },
    loading: { type: Boolean },
    hasMore: { type: Boolean, attribute: 'has-more' },
    groupByDate: { type: Boolean, attribute: 'group-by-date' },
    interactive: { type: Boolean },
    explorer: { type: Boolean },
    network: { type: String },
    privacy: { type: Boolean },
    locale: { type: String },
    emptyText: { type: String, attribute: 'empty-text' },
  };

  declare transactions: TransactionData[];
  declare loading: boolean;
  declare hasMore: boolean;
  /** Group rows under Today / Yesterday / date headings. Default true. */
  declare groupByDate: boolean;
  declare interactive: boolean;
  declare explorer: boolean;
  declare network: Network | undefined;
  declare privacy: boolean;
  declare locale: string | undefined;
  declare emptyText: string;

  constructor() {
    super();
    this.transactions = [];
    this.loading = false;
    this.hasMore = false;
    this.groupByDate = true;
    this.interactive = false;
    this.explorer = false;
    this.privacy = false;
    this.emptyText = 'No transactions yet';
  }

  #item(tx: TransactionData) {
    return html`<li>
      <bk-transaction-item
        part="item"
        .data=${tx}
        ?interactive=${this.interactive}
        ?explorer=${this.explorer}
        ?privacy=${this.privacy}
        .network=${this.network}
        locale=${this.locale ?? nothing}
      ></bk-transaction-item>
    </li>`;
  }

  override render() {
    const txs = this.transactions ?? [];
    if (!txs.length && this.loading) {
      return html`<div part="base" aria-busy="true">
        <span class="sr-only" role="status">${this.t('loading')}</span>
        ${[0, 1, 2].map(
          () =>
            html`<div class="sk">
              <bk-skeleton shape="circle" width="2.5rem"></bk-skeleton>
              <div>
                <bk-skeleton width="40%"></bk-skeleton><bk-skeleton width="25%"></bk-skeleton>
              </div>
              <bk-skeleton width="5rem"></bk-skeleton>
            </div>`,
        )}
      </div>`;
    }
    if (!txs.length) {
      return html`<div part="base">
        <slot name="empty"
          ><div class="empty">${iconSvg('transactions')}<span>${this.emptyText}</span></div></slot
        >
      </div>`;
    }
    const locale = this.localeFor(this.locale);
    let body;
    if (this.groupByDate) {
      const groups = new Map<string, TransactionData[]>();
      for (const tx of txs) {
        const g = dateGroup(tx.timestamp, locale);
        groups.set(g, [...(groups.get(g) ?? []), tx]);
      }
      body = [...groups].map(
        ([g, list]) =>
          html`<section aria-label=${g}>
            <h3 part="group">${g}</h3>
            <ul>
              ${repeat(
                list,
                (t) => t.id,
                (t) => this.#item(t),
              )}
            </ul>
          </section>`,
      );
    } else {
      body = html`<ul>
        ${repeat(
          txs,
          (t) => t.id,
          (t) => this.#item(t),
        )}
      </ul>`;
    }
    return html`<div part="base" aria-busy=${this.loading ? 'true' : 'false'}>
      ${body}
      ${
        this.hasMore
          ? html`<div class="more">
              <bk-button
                variant="ghost"
                ?loading=${this.loading}
                @click=${() => this.emit('bk-load-more')}
                >Load more</bk-button
              >
            </div>`
          : nothing
      }
    </div>`;
  }
}

define('bk-transaction-list', BkTransactionList);

declare global {
  interface HTMLElementTagNameMap {
    'bk-transaction-list': BkTransactionList;
  }
}
