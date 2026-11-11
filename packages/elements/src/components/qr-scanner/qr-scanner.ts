import { css, html, nothing, type PropertyValues } from 'lit';
import { parsePaymentInput, type PaymentInput } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../spinner/spinner.js';

/** Decodes a QR code from a video frame or image. Return null when nothing is found. */
export type QrDecoder = (source: HTMLVideoElement | ImageBitmap) => Promise<string | null>;

type ScannerState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'unsupported';

interface BarcodeDetectorLike {
  detect(source: unknown): Promise<{ rawValue: string }[]>;
}

/** Native BarcodeDetector-based decoder, or null when the browser lacks support. */
export function nativeQrDecoder(): QrDecoder | null {
  const BD = (
    globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (!BD) return null;
  let detector: BarcodeDetectorLike;
  try {
    detector = new BD({ formats: ['qr_code'] });
  } catch {
    return null;
  }
  return async (source) => {
    const codes = await detector.detect(source);
    return codes[0]?.rawValue ?? null;
  };
}

/**
 * @summary Camera QR scanner. Uses the native BarcodeDetector when available; plug in any
 * decoder (e.g. jsQR) via the `decoder` property for other browsers. Falls back to image upload
 * and shows clear messages when the camera is denied or missing. Video never leaves the device.
 * @tag bk-qr-scanner
 * @csspart base - Container.
 * @csspart video - The camera preview.
 * @csspart message - Status / fallback message.
 * @fires bk-scan - When a code is read. Detail: `{ value: string, result: PaymentInput }`.
 * @fires bk-error - On camera errors. Detail: `{ code: 'denied' | 'unavailable' | 'unsupported' }`.
 */
export class BkQrScanner extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .wrap {
        position: relative;
        display: grid;
        place-items: center;
        aspect-ratio: 1;
        width: 100%;
        max-width: 22rem;
        margin: 0 auto;
        border-radius: var(--bk-radius-lg);
        overflow: hidden;
        background: var(--bk-color-surface-3);
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .frame {
        position: absolute;
        inset: 18%;
        border: 3px solid var(--bk-color-accent);
        border-radius: var(--bk-radius-md);
        box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.35);
        pointer-events: none;
      }
      .msg {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--bk-space-3);
        padding: var(--bk-space-6);
        text-align: center;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text);
      }
      .msg svg {
        width: 2rem;
        height: 2rem;
        color: var(--bk-color-text-muted);
      }
      .hint {
        margin-top: var(--bk-space-2);
        text-align: center;
        font-size: var(--bk-font-size-sm);
        color: var(--bk-color-text-muted);
      }
      label.upload {
        display: inline-flex;
        align-items: center;
        gap: var(--bk-space-2);
        padding: var(--bk-space-2) var(--bk-space-3);
        border: 1px solid var(--bk-color-border-strong);
        border-radius: var(--bk-radius-md);
        cursor: pointer;
        font-weight: var(--bk-font-weight-semibold);
      }
      label.upload:focus-within {
        box-shadow: var(--bk-focus-ring);
      }
      label.upload svg {
        width: 1.1rem;
        height: 1.1rem;
      }
      input[type='file'] {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
    `,
  ];

  static override properties = {
    active: { type: Boolean, reflect: true },
    facing: { type: String },
    decoder: { attribute: false },
    _state: { state: true },
    _message: { state: true },
  };

  /** Camera runs while true. */
  declare active: boolean;
  /** Preferred camera. Default `environment` (rear). */
  declare facing: 'environment' | 'user';
  /** Custom decoder; defaults to the native BarcodeDetector. */
  declare decoder: QrDecoder | undefined;
  declare _state: ScannerState;
  declare _message: string;

  #stream?: MediaStream;
  #raf = 0;
  #busy = false;

  constructor() {
    super();
    this.active = false;
    this.facing = 'environment';
    this._state = 'idle';
    this._message = '';
  }

  get #decoder(): QrDecoder | null {
    return this.decoder ?? nativeQrDecoder();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stop();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('active')) {
      if (this.active) void this.start();
      else this.stop();
    }
  }

  /** Start the camera. */
  async start(): Promise<void> {
    if (this.#stream) return;
    if (!this.#decoder) {
      this.#fail('unsupported');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.#fail('unavailable');
      return;
    }
    this._state = 'starting';
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facing },
        audio: false,
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      this.#fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      return;
    }
    if (!this.active) {
      this.stop();
      return;
    }
    this._state = 'scanning';
    await this.updateComplete;
    const video = this.renderRoot.querySelector('video');
    if (!video) return;
    video.srcObject = this.#stream;
    await video.play().catch(() => undefined);
    this.#loop(video);
  }

  /** Stop the camera and release the stream. */
  stop(): void {
    cancelAnimationFrame(this.#raf);
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = undefined;
    if (this._state === 'scanning' || this._state === 'starting') this._state = 'idle';
  }

  #fail(code: 'denied' | 'unavailable' | 'unsupported') {
    this._state = code;
    this.emit('bk-error', { code });
  }

  #loop(video: HTMLVideoElement) {
    const tick = async () => {
      if (!this.#stream) return;
      if (!this.#busy && video.readyState >= 2) {
        this.#busy = true;
        try {
          const value = await this.#decoder!(video);
          if (value) {
            this.#found(value);
            return;
          }
        } catch {
          /* keep scanning */
        } finally {
          this.#busy = false;
        }
      }
      this.#raf = requestAnimationFrame(() => void tick());
    };
    this.#raf = requestAnimationFrame(() => void tick());
  }

  #found(value: string) {
    const result: PaymentInput = parsePaymentInput(value, { network: this.config.network });
    this.emit('bk-scan', { value, result });
    this.active = false;
  }

  async #onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const decoder = this.#decoder;
    if (!decoder || typeof createImageBitmap !== 'function') {
      this._message = this.t('scannerUnsupported');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const value = await decoder(bitmap);
      bitmap.close?.();
      if (value) this.#found(value);
      else this._message = this.t('noQrFound');
    } catch {
      this._message = this.t('noQrFound');
    }
  }

  #upload() {
    return html`<label class="upload"
      >${iconSvg('share')}${this.t('uploadImage')}<input
        type="file"
        accept="image/*"
        @change=${this.#onFile}
    /></label>`;
  }

  override render() {
    const s = this._state;
    let body;
    if (s === 'scanning') {
      body = html`<video part="video" playsinline muted aria-label=${this.t('scannerHint')}></video
        ><span class="frame" aria-hidden="true"></span>`;
    } else if (s === 'starting') {
      body = html`<div class="msg" part="message">
        <bk-spinner></bk-spinner>${this.t('cameraStarting')}
      </div>`;
    } else if (s === 'denied' || s === 'unavailable' || s === 'unsupported') {
      const key =
        s === 'denied'
          ? 'cameraDenied'
          : s === 'unavailable'
            ? 'cameraUnavailable'
            : 'scannerUnsupported';
      body = html`<div class="msg" part="message" role="alert">
        ${iconSvg('camera')}<span>${this.t(key)}</span>${s !== 'unsupported' && this.#decoder ? this.#upload() : nothing}
      </div>`;
    } else {
      body = html`<div class="msg" part="message">
        ${iconSvg('scan')}<span>${this.t('scannerHint')}</span>
      </div>`;
    }
    return html`<div part="base">
      <div class="wrap">${body}</div>
      ${s === 'scanning' ? html`<p class="hint">${this.t('scannerHint')}</p>` : nothing}
      ${this._message ? html`<p class="hint" role="status">${this._message}</p>` : nothing}
    </div>`;
  }
}

define('bk-qr-scanner', BkQrScanner);

declare global {
  interface HTMLElementTagNameMap {
    'bk-qr-scanner': BkQrScanner;
  }
}
