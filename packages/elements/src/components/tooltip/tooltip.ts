import { css, html } from 'lit';
import { OrangeElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

/**
 * @summary Tooltip for the slotted trigger. Opens on hover and keyboard focus, stays open while
 * hovered, and closes on Escape (WCAG 1.4.13). The text is exposed to assistive technology as
 * the trigger's description via a light-DOM element, so it works across shadow roots.
 * @tag ou-tooltip
 * @slot - The trigger element (must be focusable for keyboard users).
 * @csspart tooltip - The tooltip bubble.
 */
export class OuTooltip extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        position: relative;
        display: inline-flex;
      }
      .tip {
        position: absolute;
        left: 50%;
        z-index: var(--ou-z-tooltip);
        width: max-content;
        max-width: 16rem;
        padding: var(--ou-space-1) var(--ou-space-2);
        border-radius: var(--ou-radius-sm);
        background: var(--ou-color-text);
        color: var(--ou-color-bg);
        font-size: var(--ou-font-size-xs);
        line-height: var(--ou-line-height-tight);
        pointer-events: none;
        opacity: 0;
        transform: translate(-50%, 4px);
        transition:
          opacity var(--ou-duration-fast),
          transform var(--ou-duration-fast);
      }
      .top {
        bottom: calc(100% + 6px);
      }
      .bottom {
        top: calc(100% + 6px);
      }
      :host([data-open]) .tip {
        opacity: 1;
        transform: translate(-50%, 0);
        pointer-events: auto;
      }
    `,
  ];

  static override properties = {
    content: { type: String },
    placement: { type: String },
  };

  /** Tooltip text. */
  declare content: string;
  declare placement: 'top' | 'bottom';

  #descId = nextId('tip');
  #desc?: HTMLSpanElement;
  #timer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.content = '';
    this.placement = 'top';
    this.addEventListener('mouseenter', () => this.#show());
    this.addEventListener('mouseleave', () => this.#hideSoon());
    this.addEventListener('focusin', () => this.#show());
    this.addEventListener('focusout', () => this.#hide());
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.hasAttribute('data-open')) {
        e.stopPropagation();
        this.#hide();
      }
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  #show() {
    clearTimeout(this.#timer);
    if (this.content) this.setAttribute('data-open', '');
  }

  #hideSoon() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#hide(), 100);
  }

  #hide() {
    clearTimeout(this.#timer);
    this.removeAttribute('data-open');
  }

  protected override updated(): void {
    // Describe the trigger with a hidden light-DOM node (same tree scope as the trigger).
    if (!this.#desc) {
      this.#desc = document.createElement('span');
      this.#desc.id = this.#descId;
      this.#desc.hidden = true;
      this.#desc.slot = '__description';
      this.appendChild(this.#desc);
    }
    this.#desc.textContent = this.content;
    const trigger = [...this.children].find((c) => c !== this.#desc);
    if (trigger) {
      const ids = new Set(
        (trigger.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean),
      );
      ids.add(this.#descId);
      trigger.setAttribute('aria-describedby', [...ids].join(' '));
    }
  }

  override render() {
    return html`<slot></slot
      ><span
        class="tip ${this.placement}"
        part="tooltip"
        aria-hidden="true"
        @mouseenter=${() => this.#show()}
        @mouseleave=${() => this.#hideSoon()}
        >${this.content}</span
      >`;
  }
}

define('ou-tooltip', OuTooltip);

declare global {
  interface HTMLElementTagNameMap {
    'ou-tooltip': OuTooltip;
  }
}
