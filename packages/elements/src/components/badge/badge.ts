import { css, html } from 'lit';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/**
 * @summary Small status label.
 * @tag ou-badge
 * @slot - Badge text.
 * @slot icon - Optional leading icon.
 * @csspart base - The badge container.
 */
export class OuBadge extends OrangeElement {
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
        gap: var(--ou-space-1);
        padding: 0.125rem var(--ou-space-2);
        border-radius: var(--ou-radius-full);
        font-size: var(--ou-font-size-xs);
        font-weight: var(--ou-font-weight-semibold);
        line-height: 1.4;
        white-space: nowrap;
        border: 1px solid transparent;
        background: var(--ou-color-surface-2);
        color: var(--ou-color-text-muted);
        --ou-icon-size: 1em;
      }
      .accent {
        background: var(--ou-color-accent);
        color: var(--ou-color-on-accent);
      }
      .success {
        background: var(--ou-color-success-bg);
        color: var(--ou-color-success);
      }
      .warning {
        background: var(--ou-color-warning-bg);
        color: var(--ou-color-warning);
      }
      .danger {
        background: var(--ou-color-danger-bg);
        color: var(--ou-color-danger);
      }
      .info {
        background: var(--ou-color-info-bg);
        color: var(--ou-color-info);
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

define('ou-badge', OuBadge);

declare global {
  interface HTMLElementTagNameMap {
    'ou-badge': OuBadge;
  }
}
