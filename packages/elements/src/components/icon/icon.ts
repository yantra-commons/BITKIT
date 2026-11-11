import { css, html, nothing, svg } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { BitkitElement } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { ICONS, type IconName } from '../../internal/icons.generated.js';
import { baseStyles } from '../../internal/styles.js';

export type { IconName };
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Render an icon SVG (for use inside other components' templates). */
export function iconSvg(name: IconName) {
  const icon = ICONS[name];
  if (!icon) return nothing;
  return svg`<svg viewBox="0 0 24 24" fill=${icon.filled ? 'currentColor' : 'none'} stroke=${icon.filled ? 'none' : 'currentColor'} stroke-width="1.5" aria-hidden="true" focusable="false" part="svg">${unsafeSVG(icon.body)}</svg>`;
}

/**
 * @summary An icon from the Bitcoin Icons set (bitcoinicons.com).
 * @tag bk-icon
 * @csspart svg - The SVG element.
 * @cssprop --bk-icon-size - Icon size. Default `1.25em`.
 */
export class BkIcon extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        width: var(--bk-icon-size, 1.25em);
        height: var(--bk-icon-size, 1.25em);
        flex: none;
        color: inherit;
        vertical-align: middle;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  static override properties = {
    name: { type: String, reflect: true },
    label: { type: String },
  };

  /** Icon name, e.g. `copy`, `lightning`, `qr-code`. */
  declare name: IconName;
  /** Accessible label. When omitted the icon is decorative (hidden from assistive tech). */
  declare label: string | undefined;

  constructor() {
    super();
    this.name = 'bitcoin';
  }

  override updated(): void {
    if (this.label) {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.label);
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  override render() {
    return html`${iconSvg(this.name)}`;
  }
}

define('bk-icon', BkIcon);

declare global {
  interface HTMLElementTagNameMap {
    'bk-icon': BkIcon;
  }
}
