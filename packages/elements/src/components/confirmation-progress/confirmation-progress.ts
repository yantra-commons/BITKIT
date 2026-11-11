import { css, html, nothing } from 'lit';
import { formatEta } from '@bitkit-ui/core';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg, type IconName } from '../icon/icon.js';

/**
 * @summary On-chain confirmation progress using the Bitcoin Icons confirmation glyphs, with a
 * text label and an estimated time remaining (~10 minutes per block).
 * @tag bk-confirmation-progress
 * @csspart base - Container.
 * @csspart icon - Confirmation icon.
 * @csspart label - Text label.
 */
export class BkConfirmationProgress extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
      }
      .p {
        display: inline-flex;
        align-items: center;
        gap: var(--bk-space-2);
        font-size: var(--bk-font-size-sm);
        font-variant-numeric: tabular-nums;
      }
      .icon {
        display: inline-flex;
        width: 1.5em;
        height: 1.5em;
        color: var(--bk-color-accent-text);
      }
      .done .icon {
        color: var(--bk-color-success);
      }
      .icon svg {
        width: 100%;
        height: 100%;
      }
      .eta {
        color: var(--bk-color-text-muted);
      }
    `,
  ];

  static override properties = {
    confirmations: { type: Number },
    required: { type: Number },
    showEta: { type: Boolean, attribute: 'show-eta' },
    compact: { type: Boolean },
  };

  declare confirmations: number;
  /** Confirmations considered final. Default 6. */
  declare required: number;
  /** Show the remaining-time estimate. */
  declare showEta: boolean;
  /** Icon + "3/6" only. */
  declare compact: boolean;

  constructor() {
    super();
    this.confirmations = 0;
    this.required = 6;
    this.showEta = false;
    this.compact = false;
  }

  override render() {
    const req = Math.max(1, this.required);
    const n = Math.max(0, Math.min(this.confirmations, req));
    const done = n >= req;
    const step = Math.round((n / req) * 6);
    const label = done ? 'Confirmed' : `${n} of ${req} confirmations`;
    const left = (req - n) * 10;
    return html`<span
      class="p ${done ? 'done' : ''}"
      part="base"
      role="progressbar"
      aria-label="Confirmations"
      aria-valuemin="0"
      aria-valuemax=${req}
      aria-valuenow=${n}
      aria-valuetext=${label}
    >
      <span class="icon" part="icon">${iconSvg(`confirmations${step}` as IconName)}</span>
      <span part="label">${this.compact ? `${n}/${req}` : label}</span>
      ${this.showEta && !done && !this.compact ? html`<span class="eta">· ${formatEta(left)}</span>` : nothing}
    </span>`;
  }
}

define('bk-confirmation-progress', BkConfirmationProgress);

declare global {
  interface HTMLElementTagNameMap {
    'bk-confirmation-progress': BkConfirmationProgress;
  }
}
