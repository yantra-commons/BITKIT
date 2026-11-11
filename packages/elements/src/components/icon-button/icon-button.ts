import { css, html, nothing } from 'lit';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { buttonStyles } from '../button/button.js';
import { iconSvg, type IconName } from '../icon/icon.js';

/**
 * @summary Square button showing only an icon. `label` is required for accessibility and is
 * also shown as a native tooltip.
 * @tag bk-icon-button
 * @csspart base - The native button.
 */
export class BkIconButton extends BitkitElement {
  static override shadowRootOptions = { ...BitkitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    baseStyles,
    buttonStyles,
    css`
      :host {
        display: inline-flex;
      }
      .btn {
        width: var(--bk-control-height-md);
        padding: 0;
        --bk-icon-size: 1.25rem;
      }
      .btn.sm {
        width: var(--bk-control-height-sm);
        min-height: var(--bk-control-height-sm);
      }
      .btn.lg {
        width: var(--bk-control-height-lg);
      }
      svg {
        width: 1.25rem;
        height: 1.25rem;
      }
    `,
  ];

  static override properties = {
    icon: { type: String },
    label: { type: String },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    pressed: { type: Boolean },
  };

  declare icon: IconName;
  /** Accessible name (required). */
  declare label: string;
  declare variant: 'ghost' | 'secondary' | 'primary';
  declare size: 'sm' | 'md' | 'lg';
  declare disabled: boolean;
  /** Toggle-button state; sets aria-pressed when defined. */
  declare pressed: boolean | undefined;

  constructor() {
    super();
    this.icon = 'bitcoin';
    this.label = '';
    this.variant = 'ghost';
    this.size = 'md';
    this.disabled = false;
    this.addEventListener(
      'click',
      (e) => {
        if (this.disabled) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
  }

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('button')?.focus(options);
  }

  override render() {
    return html`<button
      class="btn ${this.variant} ${this.size}"
      part="base"
      type="button"
      aria-label=${this.label}
      title=${this.label}
      aria-disabled=${this.disabled ? 'true' : 'false'}
      aria-pressed=${this.pressed === undefined ? nothing : String(this.pressed)}
    >
      ${iconSvg(this.icon)}
    </button>`;
  }
}

define('bk-icon-button', BkIconButton);

declare global {
  interface HTMLElementTagNameMap {
    'bk-icon-button': BkIconButton;
  }
}
