/**
 * @bitkit-ui/react — React components for every bitkit-ui element.
 * Events are exposed as `on<Name>` props, e.g. `<Checkout onPaid={(e) => …} />`.
 */
export * from './generated.js';
export { wrap, type WrapperProps } from './wrap.js';
export { configure, registerAdapter } from '@bitkit-ui/elements';
