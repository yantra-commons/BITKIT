'use client';

import { useMemo, useState } from 'react';
import { MockAdapter } from '@bitkit-ui/adapters';
import { Checkout, PayButton } from '@bitkit-ui/react';

export function StoreCheckout() {
  // Swap for createHttpAdapter({ baseUrl: '/api/payments' }) backed by a Route Handler that
  // holds your provider API key server-side (see apps/examples/proxy).
  const adapter = useMemo(() => new MockAdapter(), []);
  const [status, setStatus] = useState('not started');
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <PayButton adapter={adapter} amount={21000n} description="Next.js order" />
      <Checkout
        adapter={adapter}
        amount={5000n}
        onStatusChange={(e) => setStatus(e.detail.status)}
      />
      <p>Status: {status}</p>
    </div>
  );
}
