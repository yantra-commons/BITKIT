/**
 * SSR-safe custom element registration. No-ops when `customElements` is unavailable (server
 * rendering, workers) or when the tag is already defined (e.g. two bundles on one page).
 */
export function define(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
