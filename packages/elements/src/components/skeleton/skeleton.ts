import { css, html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { OrangeElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

/**
 * @summary Placeholder shimmer shown while content loads. Hidden from assistive technology;
 * pair it with a `ou-spinner` or `aria-busy` on the region being loaded.
 * @tag ou-skeleton
 * @csspart base - The placeholder block.
 */
export class OuSkeleton extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .s {
        background: linear-gradient(
          90deg,
          var(--ou-color-surface-2) 0%,
          var(--ou-color-surface-3) 50%,
          var(--ou-color-surface-2) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s ease-in-out infinite;
        border-radius: var(--ou-radius-sm);
      }
      .circle {
        border-radius: 50%;
      }
      .text {
        height: 1em;
        border-radius: var(--ou-radius-sm);
      }
      @keyframes shimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
    `,
  ];

  static override properties = {
    shape: { type: String },
    width: { type: String },
    height: { type: String },
  };

  /** `text` (1em tall), `rect` or `circle`. */
  declare shape: 'text' | 'rect' | 'circle';
  /** CSS width. Default 100%. */
  declare width: string | undefined;
  /** CSS height. */
  declare height: string | undefined;

  constructor() {
    super();
    this.shape = 'text';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  override render() {
    const style = {
      width: this.width ?? '100%',
      height: this.height ?? (this.shape === 'text' ? '1em' : '4rem'),
    };
    if (this.shape === 'circle') style.height = this.height ?? style.width;
    return html`<div class="s ${this.shape}" part="base" style=${styleMap(style)}></div>`;
  }
}

define('ou-skeleton', OuSkeleton);

declare global {
  interface HTMLElementTagNameMap {
    'ou-skeleton': OuSkeleton;
  }
}
