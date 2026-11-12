import { StoreCheckout } from './store-checkout';

// Server component: renders static content; the payment UI is a client component.
export default function Page() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Next.js + orange-ui</h1>
      <p>The checkout below is a client component using @orange-ui/react.</p>
      <StoreCheckout />
    </main>
  );
}
