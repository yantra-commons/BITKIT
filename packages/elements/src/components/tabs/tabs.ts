import { css, html, nothing } from 'lit';
import { BitkitElement, nextId } from '../../internal/base.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';

export interface TabInfo {
  name: string;
  label: string;
  disabled?: boolean;
}

/**
 * @summary Accessible tabs (WAI-ARIA tabs pattern, automatic activation). Each child element
 * with a `slot` name and a `label` attribute becomes one tab and its panel.
 *
 * ```html
 * <bk-tabs>
 *   <div slot="lightning" label="Lightning">…</div>
 *   <div slot="onchain" label="On-chain">…</div>
 * </bk-tabs>
 * ```
 * @tag bk-tabs
 * @csspart tablist - The tab list.
 * @csspart tab - Each tab button.
 * @csspart panel - Each panel wrapper.
 * @fires bk-change - When the selected tab changes. Detail: `{ value: string }`.
 */
export class BkTabs extends BitkitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      [role='tablist'] {
        display: flex;
        gap: var(--bk-space-1);
        padding: var(--bk-space-1);
        border-radius: var(--bk-radius-md);
        background: var(--bk-color-surface-2);
      }
      [role='tab'] {
        flex: 1;
        min-height: var(--bk-control-height-sm);
        padding: 0 var(--bk-space-3);
        border: 0;
        border-radius: var(--bk-radius-sm);
        background: transparent;
        color: var(--bk-color-text-muted);
        font: inherit;
        font-size: var(--bk-font-size-sm);
        font-weight: var(--bk-font-weight-semibold);
        cursor: pointer;
        transition:
          background var(--bk-duration-fast),
          color var(--bk-duration-fast);
      }
      [role='tab'][aria-selected='true'] {
        background: var(--bk-color-surface);
        color: var(--bk-color-text);
        box-shadow: var(--bk-shadow-sm);
      }
      [role='tab']:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      [role='tabpanel'] {
        padding-top: var(--bk-space-4);
      }
      [role='tabpanel'][hidden] {
        display: none;
      }
      @media (forced-colors: active) {
        [role='tab'][aria-selected='true'] {
          outline: 2px solid Highlight;
        }
      }
    `,
  ];

  static override properties = {
    value: { type: String, reflect: true },
    label: { type: String },
    _tabs: { state: true },
  };

  /** Name of the selected tab. Defaults to the first enabled tab. */
  declare value: string;
  /** Accessible name for the tab list. */
  declare label: string | undefined;
  declare _tabs: TabInfo[];

  #id = nextId('tabs');
  #observer?: MutationObserver;

  constructor() {
    super();
    this.value = '';
    this._tabs = [];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#readTabs();
    if (typeof MutationObserver !== 'undefined') {
      this.#observer = new MutationObserver(() => this.#readTabs());
      this.#observer.observe(this, {
        childList: true,
        attributes: true,
        attributeFilter: ['label', 'slot', 'disabled'],
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  #readTabs() {
    this._tabs = [...this.children]
      .filter((c) => c.slot)
      .map((c) => ({
        name: c.slot,
        label: c.getAttribute('label') ?? c.slot,
        disabled: c.hasAttribute('disabled'),
      }));
    if (!this._tabs.some((t) => t.name === this.value && !t.disabled)) {
      this.value = this._tabs.find((t) => !t.disabled)?.name ?? '';
    }
  }

  #select(name: string, focus = false) {
    if (name === this.value) return;
    this.value = name;
    this.emit('bk-change', { value: name });
    if (focus) {
      void this.updateComplete.then(() =>
        this.renderRoot
          .querySelector<HTMLButtonElement>(`[data-name="${CSS.escape(name)}"]`)
          ?.focus(),
      );
    }
  }

  #onKeydown(e: KeyboardEvent) {
    const enabled = this._tabs.filter((t) => !t.disabled);
    const i = enabled.findIndex((t) => t.name === this.value);
    let next: TabInfo | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      this.#select(next.name, true);
    }
  }

  override render() {
    return html`<div
        role="tablist"
        part="tablist"
        aria-label=${this.label ?? nothing}
        @keydown=${this.#onKeydown}
      >
        ${this._tabs.map((t) => {
          const selected = t.name === this.value;
          return html`<button
            role="tab"
            part="tab"
            type="button"
            id="${this.#id}-tab-${t.name}"
            data-name=${t.name}
            aria-selected=${selected ? 'true' : 'false'}
            aria-controls="${this.#id}-panel-${t.name}"
            tabindex=${selected ? '0' : '-1'}
            ?disabled=${t.disabled}
            @click=${() => this.#select(t.name)}
          >
            ${t.label}
          </button>`;
        })}
      </div>
      ${this._tabs.map(
        (t) =>
          html`<div
            role="tabpanel"
            part="panel"
            id="${this.#id}-panel-${t.name}"
            aria-labelledby="${this.#id}-tab-${t.name}"
            tabindex="0"
            ?hidden=${t.name !== this.value}
          >
            <slot name=${t.name}></slot>
          </div>`,
      )}`;
  }
}

define('bk-tabs', BkTabs);

declare global {
  interface HTMLElementTagNameMap {
    'bk-tabs': BkTabs;
  }
}
