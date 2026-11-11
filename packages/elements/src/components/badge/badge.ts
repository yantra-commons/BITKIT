import { css, html } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/**
 * @summary Small status label.
 * @tag bk-badge
 * @slot - Badge text.
 * @slot icon - Optional leading icon.
 * @csspart base - The badge container.
 */
export class BkBadge extends BitkitElement {
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
        gap: var(--bk-space-1);
        padding: 0.125rem var(--bk-space-2);
        border-radius: var(--bk-radius-full);
        font-size: var(--bk-font-size-xs);
        font-weight: var(--bk-font-weight-semibold);
        line-height: 1.4;
        white-space: nowrap;
        border: 1px solid transparent;
        background: var(--bk-color-surface-2);
        color: var(--bk-color-text-muted);
        --bk-icon-size: 1em;
      }
      .accent {
        background: var(--bk-color-accent);
        color: var(--bk-color-on-accent);
      }
      .success {
        background: var(--bk-color-success-bg);
        color: var(--bk-color-success);
      }
      .warning {
        background: var(--bk-color-warning-bg);
        color: var(--bk-color-warning);
      }
      .danger {
        background: var(--bk-color-danger-bg);
        color: var(--bk-color-danger);
      }
      .info {
        background: var(--bk-color-info-bg);
        color: var(--bk-color-info);
      }
      @media (forced-colors: active) {
        .b {
          border-color: CanvasText;
        }
      }
    `,
  ];

  static override properties = { variant: { type: String, reflect: true } };

  /** Color variant. */
  declare variant: BadgeVariant;

  constructor() {
    super();
    this.variant = 'neutral';
  }

  override render() {
    return html`<span class="b ${this.variant}" part="base"
      ><slot name="icon"></slot><slot></slot
    ></span>`;
  }
}

define('bk-badge', BkBadge);

declare global {
  interface HTMLElementTagNameMap {
    'bk-badge': BkBadge;
  }
}
