import { css, html, nothing, type PropertyValues } from 'lit';
import {
  encodeLnurl,
  formatAmount,
  parseLightningAddress,
  toErrorInfo,
  type LightningAddress,
} from '@orange-ui/core';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../copy-button/copy-button.js';
import '../qr-code/qr-code.js';

export interface LnurlPayMetadata {
  minSendable: number;
  maxSendable: number;
  description?: string;
  image?: string;
}

/**
 * @summary Shareable card for a Lightning Address (LUD-16): avatar, name, copy, QR code (LNURL)
 * and open-in-wallet. Optionally fetches LNURL-pay metadata (off by default for privacy).
 * @tag ou-lightning-address-card
 * @slot - Extra content under the address.
 * @csspart base - Card.
 * @csspart avatar - Avatar.
 * @csspart address - Address text.
 * @csspart qr - QR code.
 */
export class OuLightningAddressCard extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--ou-space-4);
        padding: var(--ou-space-5);
        border: 1px solid var(--ou-color-border);
        border-radius: var(--ou-radius-lg);
        background: var(--ou-color-surface);
      }
      .who {
        display: flex;
        align-items: center;
        gap: var(--ou-space-3);
      }
      .avatar {
        flex: none;
        display: grid;
        place-items: center;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        overflow: hidden;
        background: var(--ou-color-accent);
        color: var(--ou-color-on-accent);
        font-weight: var(--ou-font-weight-bold);
        font-size: var(--ou-font-size-lg);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .name {
        margin: 0;
        font-weight: var(--ou-font-weight-semibold);
      }
      .addr {
        display: flex;
        align-items: center;
        gap: var(--ou-space-1);
        min-width: 0;
        margin: 0;
        font-size: var(--ou-font-size-sm);
        color: var(--ou-color-text-muted);
        word-break: break-all;
      }
      .addr svg {
        flex: none;
        width: 1rem;
        height: 1rem;
        color: var(--ou-color-accent-text);
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .qr {
        align-self: center;
      }
      .desc {
        margin: 0;
        font-size: var(--ou-font-size-sm);
      }
      .limits {
        font-size: var(--ou-font-size-xs);
        color: var(--ou-color-text-muted);
      }
      .open {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        gap: var(--ou-space-2);
        min-height: var(--ou-control-height-md);
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-accent);
        color: var(--ou-color-on-accent);
        font-weight: var(--ou-font-weight-semibold);
        text-decoration: none;
      }
      .open:hover {
        background: var(--ou-color-accent-hover);
      }
      .open svg {
        width: 1.1rem;
        height: 1.1rem;
      }
      .error {
        color: var(--ou-color-danger);
        font-size: var(--ou-font-size-sm);
      }
    `,
  ];

  static override properties = {
    address: { type: String },
    name: { type: String },
    avatar: { type: String },
    description: { type: String },
    qr: { type: Boolean },
    fetchMetadata: { type: Boolean, attribute: 'fetch-metadata' },
    _meta: { state: true },
    _metaError: { state: true },
  };

  /** Lightning Address, e.g. `satoshi@example.com`. */
  declare address: string;
  /** Display name. Defaults to the username. */
  declare name: string | undefined;
  /** Avatar image URL. */
  declare avatar: string | undefined;
  declare description: string | undefined;
  /** Show the QR code. Default true. */
  declare qr: boolean;
  /** Fetch LNURL-pay limits/description from the domain. Off by default (privacy). */
  declare fetchMetadata: boolean;
  declare _meta: LnurlPayMetadata | undefined;
  declare _metaError: string | undefined;

  #parsed?: LightningAddress;
  #error?: string;

  constructor() {
    super();
    this.address = '';
    this.qr = true;
    this.fetchMetadata = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('address')) {
      this.#parsed = undefined;
      this.#error = undefined;
      if (this.address.trim()) {
        try {
          this.#parsed = parseLightningAddress(this.address);
        } catch (e) {
          this.#error = toErrorInfo(e).message;
        }
      }
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (
      (changed.has('address') || changed.has('fetchMetadata')) &&
      this.fetchMetadata &&
      this.#parsed
    )
      void this.#load(this.#parsed);
  }

  async #load(p: LightningAddress) {
    this._meta = undefined;
    this._metaError = undefined;
    try {
      const res = await fetch(p.lnurlpUrl);
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as {
        minSendable: number;
        maxSendable: number;
        metadata?: string;
        status?: string;
      };
      if (j.status === 'ERROR') throw new Error('error');
      let description: string | undefined;
      let image: string | undefined;
      try {
        const md = JSON.parse(j.metadata ?? '[]') as [string, string][];
        description = md.find(([t]) => t === 'text/plain')?.[1];
        const img = md.find(([t]) => t.startsWith('image/'));
        if (img) image = `data:${img[0]},${img[1]}`;
      } catch {
        /* ignore malformed metadata */
      }
      this._meta = { minSendable: j.minSendable, maxSendable: j.maxSendable, description, image };
    } catch {
      this._metaError = 'Could not reach this Lightning Address.';
    }
  }

  override render() {
    if (this.#error)
      return html`<div class="card" part="base">
        <p class="error" role="alert">${this.#error}</p>
      </div>`;
    const p = this.#parsed;
    if (!p) return html`<div part="base"></div>`;
    const lnurl = encodeLnurl(p.lnurlpUrl);
    const name = this.name ?? p.username;
    const avatar = this.avatar ?? this._meta?.image;
    const desc = this.description ?? this._meta?.description;
    const fmt = (msat: number) => formatAmount(BigInt(Math.floor(msat)), { unit: 'sats' }).text;
    return html`<div class="card" part="base">
      <div class="who">
        <span class="avatar" part="avatar" aria-hidden="true"
          >${avatar ? html`<img src=${avatar} alt="" />` : name.slice(0, 1).toUpperCase()}</span
        >
        <div class="grow">
          <p class="name">${name}</p>
          <p class="addr" part="address">${iconSvg('lightning')}<span>${p.address}</span></p>
        </div>
        <ou-copy-button .value=${p.address} label="Copy Lightning Address"></ou-copy-button>
      </div>
      ${desc ? html`<p class="desc">${desc}</p>` : nothing}
      ${this._meta ? html`<p class="limits">Send ${fmt(this._meta.minSendable)} – ${fmt(this._meta.maxSendable)}</p>` : nothing}
      ${this._metaError ? html`<p class="error" role="status">${this._metaError}</p>` : nothing}
      ${this.qr ? html`<ou-qr-code class="qr" part="qr" .value=${lnurl} label=${`Lightning Address ${p.address}`} size="200"></ou-qr-code>` : nothing}
      <slot></slot>
      <a class="open" href=${`lightning:${lnurl}`}>${iconSvg('wallet')}Open in wallet</a>
    </div>`;
  }
}

define('ou-lightning-address-card', OuLightningAddressCard);

declare global {
  interface HTMLElementTagNameMap {
    'ou-lightning-address-card': OuLightningAddressCard;
  }
}
