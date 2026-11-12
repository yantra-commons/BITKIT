import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { encode } from 'uqr';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

/** Build an SVG path for the dark modules of a QR matrix (one subpath per horizontal run). */
export function qrPath(data: boolean[][]): string {
  let d = '';
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

/**
 * @summary Renders a value as a QR code (SVG, fully client-side). Colors stay dark-on-light in
 * every theme for scanner reliability. Put an image in the `logo` slot to overlay a logo (error
 * correction is raised to H automatically).
 * @tag ou-qr-code
 * @slot logo - Optional centered logo.
 * @csspart base - Container.
 * @csspart svg - The SVG.
 * @cssprop --ou-qr-size - Rendered size. Default from the `size` attribute.
 */
export class OuQrCode extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      .qr {
        position: relative;
        width: var(--ou-qr-size);
        max-width: 100%;
        aspect-ratio: 1;
        padding: 0;
        border-radius: var(--ou-radius-md);
        background: var(--ou-color-qr-bg);
        overflow: hidden;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .logo {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
      }
      ::slotted([slot='logo']) {
        width: 22%;
        height: 22%;
        padding: 2%;
        border-radius: 18%;
        background: var(--ou-color-qr-bg);
        object-fit: contain;
      }
      .empty {
        display: grid;
        place-items: center;
        color: var(--ou-color-text-muted);
        background: var(--ou-color-surface-2);
        font-size: var(--ou-font-size-sm);
      }
    `,
  ];

  static override properties = {
    value: { type: String },
    size: { type: Number },
    ecc: { type: String },
    margin: { type: Number },
    label: { type: String },
    _hasLogo: { state: true },
  };

  /** The data to encode (BIP21 URI, invoice, address…). */
  declare value: string;
  /** Size in CSS pixels. Default 256. */
  declare size: number;
  /** Error correction level. Default M (H when a logo is present). */
  declare ecc: QrEcc | undefined;
  /** Quiet zone in modules. Default 2 (rounded container adds visual margin). */
  declare margin: number;
  /** What the code contains, for the accessible name: "QR code for {label}". */
  declare label: string | undefined;
  declare _hasLogo: boolean;

  #path = '';
  #modules = 0;
  #error = false;

  constructor() {
    super();
    this.value = '';
    this.size = 256;
    this.margin = 2;
    this._hasLogo = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('value') ||
      changed.has('ecc') ||
      changed.has('margin') ||
      changed.has('_hasLogo')
    ) {
      this.#error = false;
      if (!this.value) {
        this.#path = '';
        return;
      }
      try {
        const qr = encode(this.value, {
          ecc: this.ecc ?? (this._hasLogo ? 'H' : 'M'),
          border: this.margin,
        });
        this.#path = qrPath(qr.data);
        this.#modules = qr.size;
      } catch {
        this.#error = true;
        this.#path = '';
      }
    }
  }

  #onLogo(e: Event) {
    this._hasLogo = (e.target as HTMLSlotElement).assignedElements().length > 0;
  }

  override render() {
    const style = `--ou-qr-size: ${this.size}px`;
    if (!this.value || this.#error) {
      return html`<div
        class="qr empty"
        part="base"
        style=${style}
        role="img"
        aria-label=${this.#error ? 'QR code could not be generated' : 'No QR code'}
      >
        ${this.#error ? 'Too much data' : nothing}
      </div>`;
    }
    const n = this.#modules;
    const name = this.t('qrCodeFor', { label: this.label ?? this.value });
    return html`<div class="qr" part="base" style=${style} role="img" aria-label=${name}>
      ${svg`<svg part="svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true">
        <rect width=${n} height=${n} fill="var(--ou-color-qr-bg)"></rect>
        <path d=${this.#path} fill="var(--ou-color-qr-fg)"></path>
      </svg>`}
      <div class="logo"><slot name="logo" @slotchange=${this.#onLogo}></slot></div>
    </div>`;
  }
}

define('ou-qr-code', OuQrCode);

declare global {
  interface HTMLElementTagNameMap {
    'ou-qr-code': OuQrCode;
  }
}
