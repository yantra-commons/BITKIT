// Client bootstrap for every page that shows live components.
import '@orange-ui/elements';
import { registerAdapter } from '@orange-ui/elements';
import { MockAdapter } from '@orange-ui/adapters/mock';

// Demo adapter: signet, unpayable. Scenario can be switched by the docs controls.
export const demoAdapter = new MockAdapter({ scenario: 'lightning', stepMs: 3000 });
registerAdapter('mock', demoAdapter);
