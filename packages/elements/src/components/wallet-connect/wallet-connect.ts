import { css, html, nothing } from 'lit';
import { parseNwcUri, toErrorInfo } from '@bitkit-ui/core';
import { BitkitElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../amount-display/amount-display.js';
import '../button/button.js';
import '../dialog/dialog.js';

/** WebLN provider subset used by the kit. */
export interface WebLNProvider {
  enable(): Promise<void>;
  getInfo?(): Promise<{ node?: { alias?: string } }>;
  getBalance?(): Promise<{ balance: number }>;
  sendPayment?(pr: string): Promise<{ preimage: string }>;
}

/**
 * Subset of `@getalby/bitcoin-connect` the component can delegate to. Pass the module:
 * `el.bitcoinConnect = await import('@getalby/bitcoin-connect')`.
 */
export interface BitcoinConnectLike {
  launchModal(): void;
  onConnected(cb: (provider: WebLNProvider) => void): () => void;
  disconnect?(): void;
}

export type WalletConnection =
  | { type: 'webln'; provider: WebLNProvider }
  | { type: 'bitcoin-connect'; provider: WebLNProvider }
  | { type: 'nwc'; uri: string; walletPubkey: string; relays: string[]; lud16?: string };

type State = 'disconnected' | 'choosing' | 'connecting' | 'connected' | 'error';

/**
 * @summary Connect a Lightning wallet via WebLN (browser extension) or Nostr Wallet Connect.
 * If Alby's Bitcoin Connect is supplied, it is used for the connection UI instead of
 * reimplementing it. NWC connection strings stay in memory and are handed to your app in the
 * `bk-connect` event; the component never stores or transmits them.
 * @tag bk-wallet-connect
 * @csspart button - Connect button.
 * @csspart connected - Connected summary.
 * @fires bk-connect - Detail: `WalletConnection`.
 * @fires bk-disconnect - When the user disconnects.
 * @fires bk-error - Detail: `{ message }`.
 */
export class BkWalletConnect extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      .connected {
        display: inline-flex;
        align-items: center;
        gap: var(--bk-space-3);
        padding: var(--bk-space-2) var(--bk-space-2) var(--bk-space-2) var(--bk-space-3);
        border: 1px solid var(--bk-color-border);
        border-radius: var(--bk-radius-full);
        background: var(--bk-color-surface);
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: var(--bk-color-success);
      }
      .name {
        font-weight: var(--bk-font-weight-semibold);
        font-size: var(--bk-font-size-sm);
      }
      .opts {
        display: grid;
        gap: var(--bk-space-2);
      }
      .opt {
        display: flex;
        align-items: center;
        gap: var(--bk-space-3);
        width: 100%;
        padding: var(--bk-space-3);
        border: 1px solid var(--bk-color-border-strong);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-surface);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .opt:hover {
        background: var(--bk-color-surface-2);
      }
      .opt svg {
        width: 1.5rem;
        height: 1.5rem;
        flex: none;
        color: var(--bk-color-accent-text);
      }
      .opt small {
        display: block;
        color: var(--bk-color-text-muted);
      }
      label {
        display: block;
        margin: var(--bk-space-4) 0 var(--bk-space-1);
        font-size: var(--bk-font-size-sm);
        font-weight: var(--bk-font-weight-medium);
      }
      input {
        width: 100%;
        min-height: var(--bk-control-height-lg);
        padding: 0 var(--bk-space-3);
        border: 1px solid var(--bk-color-border-strong);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-surface);
        color: inherit;
        font: inherit;
        font-family: var(--bk-font-mono);
        font-size: var(--bk-font-size-sm);
      }
      .hint {
        margin: var(--bk-space-1) 0 var(--bk-space-3);
        font-size: var(--bk-font-size-xs);
        color: var(--bk-color-text-muted);
      }
      .err {
        margin: var(--bk-space-2) 0;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-danger);
      }
      .ico {
        display: inline-flex;
        width: 1.2em;
        height: 1.2em;
      }
      .ico svg {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  static override properties = {
    methods: { type: Array },
    bitcoinConnect: { attribute: false },
    label: { type: String },
    showBalance: { type: Boolean, attribute: 'show-balance' },
    _state: { state: true },
    _name: { state: true },
    _balance: { state: true },
    _error: { state: true },
    _hasWebln: { state: true },
  };

  /** Offered methods. Default `['webln', 'nwc']`. */
  declare methods: ('webln' | 'nwc')[];
  /** Optional Bitcoin Connect module to delegate the connection UI to. */
  declare bitcoinConnect: BitcoinConnectLike | undefined;
  declare label: string;
  /** Show the wallet balance when the provider exposes it. */
  declare showBalance: boolean;
  declare _state: State;
  declare _name: string | undefined;
  declare _balance: bigint | undefined;
  declare _error: string | undefined;
  declare _hasWebln: boolean;

  #inputId = nextId('nwc');
  #offConnected?: () => void;

  constructor() {
    super();
    this.methods = ['webln', 'nwc'];
    this.label = 'Connect wallet';
    this.showBalance = false;
    this._state = 'disconnected';
    this._hasWebln = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._hasWebln = typeof (globalThis as { webln?: unknown }).webln !== 'undefined';
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#offConnected?.();
  }

  /** Whether a wallet is connected. */
  get connected(): boolean {
    return this._state === 'connected';
  }

  #open() {
    this._error = undefined;
    if (this.bitcoinConnect) {
      this.#offConnected?.();
      this.#offConnected = this.bitcoinConnect.onConnected(
        (provider) => void this.#finishProvider('bitcoin-connect', provider),
      );
      this.bitcoinConnect.launchModal();
      return;
    }
    this._hasWebln = typeof (globalThis as { webln?: unknown }).webln !== 'undefined';
    this._state = 'choosing';
  }

  async #connectWebln() {
    const provider = (globalThis as { webln?: WebLNProvider }).webln;
    if (!provider) return;
    this._state = 'connecting';
    try {
      await provider.enable();
      await this.#finishProvider('webln', provider);
    } catch (e) {
      this.#fail((e as Error)?.message || 'The wallet refused the connection.');
    }
  }

  async #finishProvider(type: 'webln' | 'bitcoin-connect', provider: WebLNProvider) {
    try {
      const info = await provider.getInfo?.();
      this._name = info?.node?.alias || (type === 'webln' ? 'Browser wallet' : 'Wallet');
    } catch {
      this._name = 'Wallet';
    }
    if (this.showBalance) {
      try {
        const b = await provider.getBalance?.();
        if (b) this._balance = BigInt(Math.floor(b.balance));
      } catch {
        /* balance is optional */
      }
    }
    this._state = 'connected';
    this.emit<WalletConnection>('bk-connect', { type, provider });
  }

  #connectNwc(e: Event) {
    e.preventDefault();
    const input = this.renderRoot.querySelector<HTMLInputElement>(`#${this.#inputId}`);
    const uri = input?.value.trim() ?? '';
    try {
      const c = parseNwcUri(uri);
      if (input) input.value = ''; // drop the secret from the DOM immediately
      this._name = c.lud16 ?? 'Nostr Wallet Connect';
      this._state = 'connected';
      this.emit<WalletConnection>('bk-connect', {
        type: 'nwc',
        uri,
        walletPubkey: c.walletPubkey,
        relays: c.relays,
        lud16: c.lud16,
      });
    } catch (err) {
      this._error = toErrorInfo(err).message;
    }
  }

  #fail(message: string) {
    this._state = 'error';
    this._error = message;
    this.emit('bk-error', { message });
  }

  /** Forget the connection. */
  disconnect(): void {
    this.bitcoinConnect?.disconnect?.();
    this._state = 'disconnected';
    this._name = undefined;
    this._balance = undefined;
    this.emit('bk-disconnect');
  }

  override render() {
    if (this._state === 'connected') {
      return html`<span class="connected" part="connected">
        <span class="dot" aria-hidden="true"></span>
        <span class="name">${this._name}</span>
        ${this._balance !== undefined ? html`<bk-amount-display .amount=${this._balance} size="sm"></bk-amount-display>` : nothing}
        <bk-button size="sm" variant="ghost" @click=${() => this.disconnect()}
          >Disconnect</bk-button
        >
      </span>`;
    }
    const choosing =
      this._state === 'choosing' || this._state === 'connecting' || this._state === 'error';
    return html`<bk-button
        part="button"
        ?loading=${this._state === 'connecting'}
        @click=${this.#open}
        aria-haspopup="dialog"
        ><span class="ico" slot="prefix">${iconSvg('wallet')}</span>${this.label}</bk-button
      >
      <bk-dialog
        label="Connect a wallet"
        ?open=${choosing}
        @bk-close=${() => this._state !== 'connected' && (this._state = 'disconnected')}
      >
        <div class="opts">
          ${
            this.methods.includes('webln')
              ? html`<button
                  class="opt"
                  type="button"
                  ?disabled=${!this._hasWebln}
                  @click=${this.#connectWebln}
                >
                  ${iconSvg('lightning')}
                  <span
                    >Browser extension<small
                      >${this._hasWebln ? 'Use a WebLN wallet such as Alby' : 'No WebLN wallet detected in this browser'}</small
                    ></span
                  >
                </button>`
              : nothing
          }
        </div>
        ${
          this.methods.includes('nwc')
            ? html`<form @submit=${this.#connectNwc}>
                <label for=${this.#inputId}>Nostr Wallet Connect</label>
                <input
                  id=${this.#inputId}
                  type="password"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="nostr+walletconnect://…"
                  aria-describedby="${this.#inputId}-hint"
                />
                <p class="hint" id="${this.#inputId}-hint">
                  Paste a connection link from your wallet. It stays on this device.
                </p>
                <bk-button type="submit" block variant="secondary">Connect</bk-button>
              </form>`
            : nothing
        }
        ${this._error ? html`<p class="err" role="alert">${this._error}</p>` : nothing}
      </bk-dialog>`;
  }
}

define('bk-wallet-connect', BkWalletConnect);

declare global {
  interface HTMLElementTagNameMap {
    'bk-wallet-connect': BkWalletConnect;
  }
}
