import { LitElement } from 'lit';
import { cssText } from '@bitkit-ui/tokens';
import { CONFIG_EVENT, getConfig, resolveLocale } from './config.js';
import { interpolate, type StringKey } from './strings.js';

let tokensInjected = false;

/**
 * Add the token stylesheet to the document once. Uses a constructable stylesheet when possible
 * (works under strict CSP without 'unsafe-inline'), otherwise a <style data-bk-tokens> tag.
 * Token selectors use :where() so any app-level override wins.
 */
export function injectTokens(): void {
  if (tokensInjected || typeof document === 'undefined' || !getConfig().injectTokens) return;
  tokensInjected = true;
  if (document.querySelector('style[data-bk-tokens], link[data-bk-tokens]')) return;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    document.adoptedStyleSheets = [sheet, ...document.adoptedStyleSheets];
  } catch {
    const style = document.createElement('style');
    style.setAttribute('data-bk-tokens', '');
    style.textContent = cssText;
    document.head.prepend(style);
  }
}

/** Base class for every bitkit-ui element. */
export class BitkitElement extends LitElement {
  #onConfig = () => this.requestUpdate();

  override connectedCallback(): void {
    injectTokens();
    super.connectedCallback();
    globalThis.addEventListener?.(CONFIG_EVENT, this.#onConfig);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    globalThis.removeEventListener?.(CONFIG_EVENT, this.#onConfig);
  }

  /** Dispatch a bubbling, composed CustomEvent. Returns false if a listener called preventDefault. */
  protected emit<T>(name: string, detail?: T, options: { cancelable?: boolean } = {}): boolean {
    return this.dispatchEvent(
      new CustomEvent<T>(name, {
        detail,
        bubbles: true,
        composed: true,
        cancelable: options.cancelable ?? false,
      }),
    );
  }

  /** Localised UI string. */
  protected t(key: StringKey, vars?: Record<string, string | number>): string {
    return interpolate(getConfig().strings[key], vars);
  }

  protected get config() {
    return getConfig();
  }

  protected localeFor(explicit?: string): string {
    return resolveLocale(explicit);
  }
}

let uid = 0;
/** Unique id for ARIA relationships inside a shadow root. */
export const nextId = (prefix = 'bk') => `${prefix}-${++uid}`;
