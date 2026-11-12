/**
 * @orange-ui/react — React components for every orange-ui element.
 * Events are exposed as `on<Name>` props, e.g. `<Checkout onPaid={(e) => …} />`.
 */
export * from './generated.js';
export { wrap, type WrapperProps } from './wrap.js';
export { configure, registerAdapter } from '@orange-ui/elements';
