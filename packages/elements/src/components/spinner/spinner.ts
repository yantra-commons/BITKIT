import { css, html } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

/**
 * @summary Indeterminate loading indicator. Announces its label politely to screen readers.
 * @tag bk-spinner
 * @csspart base - The spinning ring.
 * @cssprop --bk-spinner-size - Diameter. Default `1.25em`.
 * @cssprop --bk-spinner-color - Arc color. Default `currentColor`.
 */
export class BkSpinner extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .ring {
        width: var(--bk-spinner-size, 1.25em);
        height: var(--bk-spinner-size, 1.25em);
        border-radius: 50%;
        border: 2px solid color-mix(in srgb, var(--bk-spinner-color, currentColor) 25%, transparent);
        border-top-color: var(--bk-spinner-color, currentColor);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ring {
          animation: pulse 1.6s ease-in-out infinite !important;
          animation-duration: 1.6s !important;
          animation-iteration-count: infinite !important;
        }
        @keyframes pulse {
          50% {
            opacity: 0.4;
          }
        }
      }
    `,
  ];

  static override properties = { label: { type: String } };

  /** Accessible label. Default "Loading". */
  declare label: string | undefined;

  override render() {
    return html`<span role="status"
      ><span class="ring" part="base" aria-hidden="true"></span
      ><span class="sr-only">${this.label ?? this.t('loading')}</span></span
    >`;
  }
}

define('bk-spinner', BkSpinner);

declare global {
  interface HTMLElementTagNameMap {
    'bk-spinner': BkSpinner;
  }
}
