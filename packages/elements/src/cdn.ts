/**
 * CDN entry: every component, the adapters, and a pre-registered `mock` adapter so plain HTML
 * works with no build step:
 *
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@bitkit-ui/elements/dist/cdn/bitkit-ui.js"></script>
 * <bk-pay-button amount="21000" adapter="mock"></bk-pay-button>
 */
import { MockAdapter } from '@bitkit-ui/adapters';
import { registerAdapter } from './internal/adapters.js';

export * from './index.js';
export * from '@bitkit-ui/adapters';

registerAdapter('mock', () => new MockAdapter());
