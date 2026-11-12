import { css, html, nothing } from 'lit';
import {
  addressForScreenReader,
  ADDRESS_TYPE_LABELS,
  chunkAddress,
  explorerUrl,
  truncateMiddle,
  validateAddress,
  type Network,
} from '@orange-ui/core';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../copy-button/copy-button.js';
import '../network-badge/network-badge.js';
import '../qr-code/qr-code.js';

/**
 * @summary Shows a Bitcoin address in readable 4-character chunks (Bitcoin Design Guide), with
 * copy, QR toggle, network badge and explorer link. Screen readers hear it character by character.
 * @tag ou-address-display
 * @csspart base - Wrapper.
 * @csspart address - The address text.
 * @csspart chunk - Each chunk.
 * @csspart actions - Action buttons.
 * @csspart qr - The QR code.
 * @fires ou-copy - When the address is copied. Detail: `{ value }`.
 */
export class OuAddressDisplay extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-2);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ou-space-2);
        font-size: var(--ou-font-size-xs);
        color: var(--ou-color-text-muted);
      }
      .label {
        font-size: var(--ou-font-size-sm);
        font-weight: var(--ou-font-weight-medium);
        color: var(--ou-color-text);
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: var(--ou-space-2);
      }
      .addr {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-family: var(--ou-font-mono);
        font-size: var(--ou-font-size-md);
        line-height: 1.7;
        word-break: break-all;
        color: var(--ou-color-text);
      }
      .chunks {
        display: flex;
        flex-wrap: wrap;
        column-gap: 0.55em;
      }
      .chunk:nth-child(even) {
        color: var(--ou-color-text-muted);
      }
      .actions {
        display: inline-flex;
        gap: var(--ou-space-1);
        flex: none;
      }
      .icon-btn {
        display: inline-grid;
        place-items: center;
        width: var(--ou-control-height-md);
        height: var(--ou-control-height-md);
        border: 0;
        border-radius: var(--ou-radius-md);
        background: transparent;
        color: var(--ou-color-text);
        cursor: pointer;
        text-decoration: none;
      }
      .icon-btn:hover {
        background: var(--ou-color-surface-2);
      }
      .icon-btn svg {
        width: 1.15rem;
        height: 1.15rem;
      }
      .expand {
        all: unset;
        cursor: pointer;
        border-radius: var(--ou-radius-sm);
      }
      .expand:focus-visible {
        box-shadow: var(--ou-focus-ring);
      }
      .qr {
        align-self: center;
        padding-top: var(--ou-space-2);
      }
      .invalid {
        color: var(--ou-color-danger);
        font-size: var(--ou-font-size-sm);
      }
      .empty {
        color: var(--ou-color-text-muted);
      }
    `,
  ];

  static override properties = {
    address: { type: String },
    network: { type: String },
    label: { type: String },
    chunked: { type: Boolean },
    chunkSize: { type: Number, attribute: 'chunk-size' },
    truncate: { type: String },
    truncateStart: { type: Number, attribute: 'truncate-start' },
    truncateEnd: { type: Number, attribute: 'truncate-end' },
    copyable: { type: Boolean },
    qr: { type: Boolean },
    qrOpen: { type: Boolean, attribute: 'qr-open', reflect: true },
    explorer: { type: Boolean },
    explorerBaseUrl: { type: String, attribute: 'explorer-base-url' },
    showNetwork: { type: Boolean, attribute: 'show-network' },
    showType: { type: Boolean, attribute: 'show-type' },
    _expanded: { state: true },
  };

  declare address: string;
  /** Network for explorer links; detected from the address when omitted. */
  declare network: Network | undefined;
  /** Label shown above the address. */
  declare label: string | undefined;
  /** Split into 4-character chunks. Default true. */
  declare chunked: boolean;
  declare chunkSize: number;
  /** `none` or `middle` ("bc1qar0s…zwf5mdq", click to expand). */
  declare truncate: 'none' | 'middle';
  declare truncateStart: number;
  declare truncateEnd: number;
  /** Show a copy button. Default true. */
  declare copyable: boolean;
  /** Show a QR toggle button. */
  declare qr: boolean;
  /** Whether the QR code is visible. */
  declare qrOpen: boolean;
  /** Show a block-explorer link. */
  declare explorer: boolean;
  declare explorerBaseUrl: string | undefined;
  /** Show the network badge. */
  declare showNetwork: boolean;
  /** Show the address type (e.g. Taproot). */
  declare showType: boolean;
  declare _expanded: boolean;

  constructor() {
    super();
    this.address = '';
    this.chunked = true;
    this.chunkSize = 4;
    this.truncate = 'none';
    this.truncateStart = 10;
    this.truncateEnd = 8;
    this.copyable = true;
    this.qr = false;
    this.qrOpen = false;
    this.explorer = false;
    this.showNetwork = false;
    this.showType = false;
    this._expanded = false;
  }

  override render() {
    const addr = this.address.trim();
    if (!addr) {
      return html`<div class="wrap" part="base"><span class="empty">—</span></div>`;
    }
    const v = validateAddress(addr);
    const info = v.valid ? v.info : undefined;
    const network: Network =
      this.network ??
      (info?.networks.includes(this.config.network)
        ? this.config.network
        : (info?.networks[0] ?? this.config.network));
    // bech32 is case-insensitive; show it lower-case. base58 is case-sensitive; keep as-is.
    const display = /^(bc|tb|bcrt)1/i.test(addr) ? addr.toLowerCase() : addr;
    const truncated = this.truncate === 'middle' && !this._expanded;
    const text = truncated
      ? truncateMiddle(display, { start: this.truncateStart, end: this.truncateEnd })
      : display;
    const visual =
      this.chunked && !truncated
        ? html`<span class="chunks"
            >${chunkAddress(display, this.chunkSize).map((c) => html`<span class="chunk" part="chunk">${c}</span>`)}</span
          >`
        : html`<span>${text}</span>`;
    const sr = `${this.label ?? this.t('bitcoinAddress')}: ${addressForScreenReader(display, this.chunkSize)}`;
    const url = this.explorer
      ? explorerUrl(
          'address',
          display,
          network,
          this.explorerBaseUrl ?? this.config.explorerBaseUrl,
        )
      : null;

    return html`<div class="wrap" part="base">
      ${
        this.label || this.showNetwork || this.showType
          ? html`<div class="meta">
              ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
              ${this.showType && info ? html`<span>${ADDRESS_TYPE_LABELS[info.type]}</span>` : nothing}
              ${this.showNetwork ? html`<ou-network-badge network=${network}></ou-network-badge>` : nothing}
            </div>`
          : nothing
      }
      <div class="row">
        <p class="addr" part="address">
          ${
            truncated
              ? html`<button
                  class="expand"
                  type="button"
                  aria-expanded="false"
                  title=${this.t('showFullAddress')}
                  @click=${() => (this._expanded = true)}
                >
                  <span aria-hidden="true">${visual}</span
                  ><span class="sr-only">${sr}. ${this.t('showFullAddress')}</span>
                </button>`
              : html`<span aria-hidden="true">${visual}</span><span class="sr-only">${sr}</span>`
          }
        </p>
        <span class="actions" part="actions">
          ${this.copyable ? html`<ou-copy-button .value=${display}></ou-copy-button>` : nothing}
          ${
            this.qr
              ? html`<button
                  class="icon-btn"
                  type="button"
                  aria-pressed=${this.qrOpen ? 'true' : 'false'}
                  aria-label=${this.qrOpen ? this.t('hideQr') : this.t('showQr')}
                  title=${this.qrOpen ? this.t('hideQr') : this.t('showQr')}
                  @click=${() => (this.qrOpen = !this.qrOpen)}
                >
                  ${iconSvg('qr-code')}
                </button>`
              : nothing
          }
          ${
            url
              ? html`<a
                  class="icon-btn"
                  href=${url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label=${this.t('viewOnExplorer')}
                  title=${this.t('viewOnExplorer')}
                  >${iconSvg('export')}</a
                >`
              : nothing
          }
        </span>
      </div>
      ${!v.valid ? html`<span class="invalid" role="note">${this.t('invalidAddress')}: ${v.error.message}</span>` : nothing}
      ${
        this.qrOpen
          ? html`<ou-qr-code
              class="qr"
              part="qr"
              .value=${/^(bc|tb|bcrt)1/i.test(display) ? display.toUpperCase() : display}
              label=${this.t('bitcoinAddress')}
              size="200"
            ></ou-qr-code>`
          : nothing
      }
    </div>`;
  }
}

define('ou-address-display', OuAddressDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'ou-address-display': OuAddressDisplay;
  }
}
