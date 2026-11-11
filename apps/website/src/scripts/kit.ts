// Client bootstrap for every page that shows live components.
import '@bitkit-ui/elements';
import { registerAdapter } from '@bitkit-ui/elements';
import { MockAdapter } from '@bitkit-ui/adapters/mock';

// Demo adapter: signet, unpayable. Scenario can be switched by the docs controls.
export const demoAdapter = new MockAdapter({ scenario: 'lightning', stepMs: 3000 });
registerAdapter('mock', demoAdapter);
