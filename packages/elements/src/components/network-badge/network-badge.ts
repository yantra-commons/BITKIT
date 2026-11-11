import { css, html } from 'lit';
import type { Network } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import type { StringKey } from '../../internal/strings.js';

const KEY: Record<Network, StringKey> = {
  mainnet: 'networkMainnet',
  testnet: 'networkTestnet',
  testnet4: 'networkTestnet4',
  signet: 'networkSignet',
  regtest: 'networkRegtest',
};

/**
 * @summary Shows which Bitcoin network is in use. Test networks are highlighted so users never
 * confuse test coins with real ones.
 * @tag bk-network-badge
 * @csspart base - The badge.
 */
export class BkNetworkBadge extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .b {
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        padding: 0.125rem var(--bk-space-2);
        border-radius: var(--bk-radius-full);
        border: 1px solid var(--bk-color-border);
        font-size: var(--bk-font-size-xs);
        font-weight: var(--bk-font-weight-semibold);
        line-height: 1.4;
        white-space: nowrap;
        color: var(--bk-color-text-muted);
        background: var(--bk-color-surface);
      }
      .dot {
        width: 0.5em;
        height: 0.5em;
        border-radius: 50%;
        background: currentColor;
      }
      .mainnet .dot {
        background: var(--bk-color-accent);
      }
      .testnet,
      .testnet4,
      .signet {
        color: var(--bk-color-info);
        background: var(--bk-color-info-bg);
        border-color: transparent;
      }
      .regtest {
        color: var(--bk-color-warning);
        background: var(--bk-color-warning-bg);
        border-color: transparent;
      }
    `,
  ];

  static override properties = {
    network: { type: String, reflect: true },
    hideMainnet: { type: Boolean, attribute: 'hide-mainnet' },
  };

  /** Network; defaults to the global config network. */
  declare network: Network | undefined;
  /** Render nothing on mainnet (show only for test networks). */
  declare hideMainnet: boolean;

  constructor() {
    super();
    this.hideMainnet = false;
  }

  override render() {
    const net = this.network ?? this.config.network;
    if (this.hideMainnet && net === 'mainnet') return html``;
    const label = this.t(KEY[net] ?? 'networkMainnet');
    return html`<span class="b ${net}" part="base"
      ><span class="dot" aria-hidden="true"></span>${label}</span
    >`;
  }
}

define('bk-network-badge', BkNetworkBadge);

declare global {
  interface HTMLElementTagNameMap {
    'bk-network-badge': BkNetworkBadge;
  }
}
