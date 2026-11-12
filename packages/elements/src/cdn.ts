/**
 * CDN entry: every component, the adapters, and a pre-registered `mock` adapter so plain HTML
 * works with no build step:
 *
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@orange-ui/elements/dist/cdn/orange-ui.js"></script>
 * <ou-pay-button amount="21000" adapter="mock"></ou-pay-button>
 */
import { MockAdapter } from '@orange-ui/adapters';
import { registerAdapter } from './internal/adapters.js';

export * from './index.js';
export * from '@orange-ui/adapters';

registerAdapter('mock', () => new MockAdapter());
