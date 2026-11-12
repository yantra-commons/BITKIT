import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MockAdapter } from '@orange-ui/adapters';
import { AmountDisplay, BalanceCard, Checkout, PayButton, TransactionList } from '@orange-ui/react';

const products = [
  { id: 'flat-white', name: 'Flat white', sats: 21_000n },
  { id: 'croissant', name: 'Croissant', sats: 12_000n },
  { id: 'beans', name: 'Beans (250 g)', sats: 150_000n },
];

function App() {
  // In production, use an adapter that talks to your server, e.g.
  // createHttpAdapter({ baseUrl: '/api/payments' }) — see apps/examples/proxy.
  const adapter = useMemo(() => new MockAdapter({ stepMs: 2500 }), []);
  const [paid, setPaid] = useState<string[]>([]);

  return (
    <main
      style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui' }}
    >
      <h1>Satoshi's Coffee (React)</h1>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        {products.map((p) => (
          <section
            key={p.id}
            style={{ border: '1px solid #ddd', borderRadius: 16, padding: '1rem' }}
          >
            <h2 style={{ fontSize: '1rem' }}>{p.name}</h2>
            <AmountDisplay amount={p.sats} showFiat fiatCurrency="USD" fiatPrice="97250" />
            <div style={{ marginTop: '0.75rem' }}>
              <PayButton
                adapter={adapter}
                amount={p.sats}
                description={p.name}
                onPaid={(e) => setPaid((list) => [...list, e.detail.invoice.id])}
              >
                Buy
              </PayButton>
            </div>
          </section>
        ))}
      </div>

      <h2 style={{ marginTop: '2.5rem' }}>Inline checkout</h2>
      <div style={{ maxWidth: 420 }}>
        <Checkout
          adapter={adapter}
          amount={50_000n}
          description="Gift card"
          onStatusChange={(e) => console.log(e.detail.status)}
        />
      </div>

      <h2 style={{ marginTop: '2.5rem' }}>Wallet widgets</h2>
      <BalanceCard balance={2_450_000n} fiatCurrency="USD" fiatPrice="97250" />
      <TransactionList
        transactions={paid.map((id, i) => ({
          id,
          direction: 'incoming' as const,
          amount: 21000,
          timestamp: Date.now() - i * 1000,
          label: `Order ${id}`,
        }))}
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
