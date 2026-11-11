/**
 * @bitkit-ui/vue — Vue 3 components for every bitkit-ui element.
 * Events use Vue names: `<Checkout @paid="…" @status-change="…" />`.
 */
export * from './generated.js';
export { wrap, isCustomElement } from './wrap.js';
export { configure, registerAdapter } from '@bitkit-ui/elements';
