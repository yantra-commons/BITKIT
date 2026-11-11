import { css, html, nothing } from 'lit';
import { explorerUrl, formatRelativeTime, truncateMiddle, type Network } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { bigintConverter, toBigint } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../amount-display/amount-display.js';
import '../confirmation-progress/confirmation-progress.js';

export type TxDirection = 'incoming' | 'outgoing' | 'self';
export type TxStatus = 'pending' | 'confirmed' | 'failed';

/** Transaction data accepted by bk-transaction-item / bk-transaction-list. */
export interface TransactionData {
  id: string;
  direction: TxDirection;
  /** Sats (absolute value). */
  amount: bigint | number | string;
  fee?: bigint | number | string;
  status?: TxStatus;
  confirmations?: number;
  /** Unix ms. */
  timestamp?: number;
  label?: string;
  method?: 'lightning' | 'onchain';
  /** On-chain txid for explorer links. */
  txid?: string;
}

/**
 * @summary One transaction row: direction icon, label, relative time, status/confirmations and a
 * signed amount. Activates with click/Enter when `interactive`.
 * @tag bk-transaction-item
 * @csspart base - Row.
 * @csspart icon - Direction icon.
 * @csspart label - Title.
 * @csspart meta - Time and status line.
 * @csspart amount - Amount.
 * @fires bk-select - When activated. Detail: `{ id }`.
 */
export class BkTransactionItem extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .tx {
        display: flex;
        align-items: center;
        gap: var(--bk-space-3);
        width: 100%;
        padding: var(--bk-space-3);
        border: 0;
        border-radius: var(--bk-radius-md);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
      }
      button.tx {
        cursor: pointer;
      }
      button.tx:hover {
        background: var(--bk-color-surface-2);
      }
      .icon {
        flex: none;
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        background: var(--bk-color-surface-2);
        color: var(--bk-color-text-muted);
      }
      .incoming .icon {
        background: var(--bk-color-success-bg);
        color: var(--bk-color-success);
      }
      .icon svg {
        width: 1.25rem;
        height: 1.25rem;
      }
      .mid {
        flex: 1;
        min-width: 0;
      }
      .label {
        margin: 0;
        font-weight: var(--bk-font-weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--bk-space-2);
        margin: 2px 0 0;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text-muted);
      }
      .bolt {
        display: inline-flex;
        width: 0.9rem;
        height: 0.9rem;
        color: var(--bk-color-accent-text);
      }
      .bolt svg {
        width: 100%;
        height: 100%;
      }
      .failed {
        color: var(--bk-color-danger);
      }
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex: none;
      }
      .fee {
        font-size: var(--bk-font-size-xs);
        color: var(--bk-color-text-muted);
      }
      a {
        color: var(--bk-color-text-muted);
        font-size: var(--bk-font-size-xs);
      }
      bk-confirmation-progress {
        font-size: var(--bk-font-size-xs);
      }
    `,
  ];

  static override properties = {
    txId: { type: String, attribute: 'tx-id' },
    direction: { type: String, reflect: true },
    amount: { converter: bigintConverter },
    fee: { converter: bigintConverter },
    status: { type: String, reflect: true },
    confirmations: { type: Number },
    requiredConfirmations: { type: Number, attribute: 'required-confirmations' },
    timestamp: { type: Number },
    label: { type: String },
    method: { type: String },
    txid: { type: String },
    network: { type: String },
    interactive: { type: Boolean },
    explorer: { type: Boolean },
    privacy: { type: Boolean },
    locale: { type: String },
  };

  declare txId: string;
  declare direction: TxDirection;
  /** Sats (absolute). */
  declare amount: bigint | undefined;
  declare fee: bigint | undefined;
  declare status: TxStatus;
  declare confirmations: number | undefined;
  declare requiredConfirmations: number;
  /** Unix ms. */
  declare timestamp: number | undefined;
  declare label: string | undefined;
  declare method: 'lightning' | 'onchain';
  declare txid: string | undefined;
  declare network: Network | undefined;
  /** Render as a button and emit bk-select. */
  declare interactive: boolean;
  /** Link the txid to a block explorer (ignored when `interactive`, to avoid nested controls). */
  declare explorer: boolean;
  declare privacy: boolean;
  declare locale: string | undefined;

  constructor() {
    super();
    this.txId = '';
    this.direction = 'incoming';
    this.status = 'confirmed';
    this.requiredConfirmations = 6;
    this.method = 'onchain';
    this.interactive = false;
    this.explorer = false;
    this.privacy = false;
  }

  /** Populate from a TransactionData object. */
  set data(d: TransactionData) {
    this.txId = d.id;
    this.direction = d.direction;
    this.amount = toBigint(d.amount);
    this.fee = toBigint(d.fee);
    this.status = d.status ?? 'confirmed';
    this.confirmations = d.confirmations;
    this.timestamp = d.timestamp;
    this.label = d.label;
    this.method = d.method ?? 'onchain';
    this.txid = d.txid;
  }

  override render() {
    const out = this.direction === 'outgoing';
    const title =
      this.label ??
      (this.direction === 'incoming' ? 'Received' : out ? 'Sent' : 'Moved between your accounts');
    const when = this.timestamp
      ? formatRelativeTime(this.timestamp, Date.now(), this.localeFor(this.locale))
      : undefined;
    const pendingOnchain = this.status === 'pending' && this.method === 'onchain';
    // Links cannot be nested inside the interactive row button (nested-interactive).
    const url =
      this.explorer && this.txid && !this.interactive
        ? explorerUrl(
            'tx',
            this.txid,
            this.network ?? this.config.network,
            this.config.explorerBaseUrl,
          )
        : null;
    const amount = toBigint(this.amount);
    const body = html`
      <span class="icon" part="icon" aria-hidden="true"
        >${iconSvg(this.direction === 'incoming' ? 'arrow-down' : this.direction === 'outgoing' ? 'arrow-up' : 'exchange')}</span
      >
      <span class="mid">
        <p class="label" part="label">${title}</p>
        <p class="meta" part="meta">
          ${this.method === 'lightning' ? html`<span class="bolt" title="Lightning">${iconSvg('lightning')}</span><span class="sr-only">Lightning</span>` : nothing}
          ${when ? html`<time datetime=${new Date(this.timestamp!).toISOString()}>${when}</time>` : nothing}
          ${this.status === 'failed' ? html`<span class="failed">Failed</span>` : nothing}
          ${
            pendingOnchain
              ? html`<bk-confirmation-progress
                  compact
                  .confirmations=${this.confirmations ?? 0}
                  .required=${this.requiredConfirmations}
                ></bk-confirmation-progress>`
              : this.status === 'pending'
                ? html`<span>Pending</span>`
                : nothing
          }
          ${url ? html`<a href=${url} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${truncateMiddle(this.txid!, { start: 6, end: 6 })}</a>` : nothing}
        </p>
      </span>
      <span class="right">
        <bk-amount-display
          part="amount"
          .amount=${amount === undefined ? undefined : out ? -amount : amount}
          sign-display="always"
          direction=${this.direction === 'incoming' ? 'incoming' : 'outgoing'}
          ?privacy=${this.privacy}
          locale=${this.locale ?? nothing}
        ></bk-amount-display>
        ${this.fee && out && !this.privacy ? html`<span class="fee">Fee ${this.fee.toLocaleString(this.localeFor(this.locale))} sats</span>` : nothing}
      </span>
    `;
    const cls = `tx ${this.direction} ${this.status}`;
    return this.interactive
      ? html`<button
          class=${cls}
          part="base"
          type="button"
          @click=${() => this.emit('bk-select', { id: this.txId })}
        >
          ${body}
        </button>`
      : html`<div class=${cls} part="base">${body}</div>`;
  }
}

define('bk-transaction-item', BkTransactionItem);

declare global {
  interface HTMLElementTagNameMap {
    'bk-transaction-item': BkTransactionItem;
  }
}
