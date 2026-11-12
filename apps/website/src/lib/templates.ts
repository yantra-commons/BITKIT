/**
 * Full-page templates. Each renders live at /templates/<slug>/ (using the bundled kit) and is
 * offered as a single copyable HTML file that loads the CDN build.
 */
export interface Template {
  slug: string;
  title: string;
  description: string;
  css: string;
  body: string;
  /** Optional module script (runs after the kit loads). */
  script?: string;
}

const SHARED_CSS = `body { margin: 0; font-family: var(--ou-font-sans); background: var(--ou-color-bg); color: var(--ou-color-text); }
main { width: min(100% - 2rem, 64rem); margin: 0 auto; padding: 2.5rem 0 4rem; }
h1 { letter-spacing: -0.02em; }
.muted { color: var(--ou-color-text-muted); }`;

export const templates: Template[] = [
  {
    slug: 'merchant-checkout',
    title: 'Merchant checkout',
    description:
      'A product page with a cart summary and an inline checkout that accepts Lightning and on-chain.',
    css: `${SHARED_CSS}
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 26rem); gap: 2rem; align-items: start; }
@media (max-width: 52rem) { .grid { grid-template-columns: minmax(0, 1fr); } }
.cart { padding: 1.5rem; border: 1px solid var(--ou-color-border); border-radius: var(--ou-radius-lg); background: var(--ou-color-surface); }
.line { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--ou-color-border); }
.total { display: flex; justify-content: space-between; padding-top: 1rem; font-weight: 700; }`,
    body: `<main>
  <p class="muted">Satoshi's Coffee Roasters</p>
  <h1>Checkout</h1>
  <div class="grid">
    <section class="cart" aria-label="Order summary">
      <div class="line"><span>Ethiopia Yirgacheffe, 250 g</span><ou-amount-display amount="18000"></ou-amount-display></div>
      <div class="line"><span>Shipping</span><ou-amount-display amount="3000"></ou-amount-display></div>
      <div class="total"><span>Total</span><ou-amount-display amount="21000" show-fiat fiat-currency="USD" fiat-price="97250"></ou-amount-display></div>
    </section>
    <ou-checkout amount="21000" adapter="mock" description="Order #1042" order-id="1042" fiat-currency="USD" fiat-price="97250"></ou-checkout>
  </div>
</main>`,
    script: `document.querySelector('ou-checkout').addEventListener('ou-paid', (e) => {
  // Fulfil the order server-side from your provider's webhook, not from this event.
  console.log('paid', e.detail.invoice.id);
});`,
  },
  {
    slug: 'donation',
    title: 'Donation page',
    description:
      'A project support page with preset amounts, a custom amount, a message and a Lightning Address card.',
    css: `${SHARED_CSS}
.hero { text-align: center; max-width: 40rem; margin: 0 auto 2rem; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 20rem); gap: 1.5rem; align-items: start; }
@media (max-width: 52rem) { .cols { grid-template-columns: minmax(0, 1fr); } }`,
    body: `<main>
  <div class="hero">
    <h1>Keep open-source Bitcoin tools free</h1>
    <p class="muted">Your support pays for maintenance, audits and new features. Thank you!</p>
  </div>
  <div class="cols">
    <ou-donation-widget adapter="mock" heading="Make a donation" presets="2100,21000,100000,500000" fiat-currency="USD" fiat-price="97250">
      <p slot="description">Choose an amount in sats or enter your own.</p>
    </ou-donation-widget>
    <ou-lightning-address-card address="tips@example.com" name="Orange UI project" description="Or zap us from any Lightning wallet."></ou-lightning-address-card>
  </div>
</main>`,
  },
  {
    slug: 'invoice',
    title: 'Invoice page',
    description: 'A shareable invoice for freelancers: line items, due amount, and a pay button.',
    css: `${SHARED_CSS}
.paper { max-width: 40rem; margin: 0 auto; padding: 2rem; border: 1px solid var(--ou-color-border); border-radius: var(--ou-radius-lg); background: var(--ou-color-surface); }
.head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
th, td { padding: 0.6rem 0; text-align: left; border-bottom: 1px solid var(--ou-color-border); }
td:last-child, th:last-child { text-align: right; }
.due { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }`,
    body: `<main>
  <article class="paper">
    <div class="head">
      <div><h1 style="margin:0">Invoice #2026-014</h1><p class="muted">Issued Nov 12, 2026 · Due in 14 days</p></div>
      <div style="text-align:right"><strong>Alice Design Studio</strong><br /><span class="muted">alice@example.com</span></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Logo design</td><td><ou-amount-display amount="400000"></ou-amount-display></td></tr>
        <tr><td>Brand guidelines</td><td><ou-amount-display amount="250000"></ou-amount-display></td></tr>
      </tbody>
    </table>
    <div class="due">
      <div><span class="muted">Amount due</span><br /><ou-amount-display amount="650000" size="xl" show-fiat fiat-currency="EUR" fiat-price="90000"></ou-amount-display></div>
      <ou-pay-button amount="650000" adapter="mock" description="Invoice #2026-014" size="lg">Pay invoice</ou-pay-button>
    </div>
  </article>
</main>`,
  },
  {
    slug: 'wallet-dashboard',
    title: 'Wallet dashboard',
    description:
      'Balance, send and receive actions, fee picker and transaction history for a watch-only or Lightning wallet UI.',
    css: `${SHARED_CSS}
.top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.grid { display: grid; grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
@media (max-width: 56rem) { .grid { grid-template-columns: minmax(0, 1fr); } }
.card { padding: 1.25rem; border: 1px solid var(--ou-color-border); border-radius: var(--ou-radius-lg); background: var(--ou-color-surface); }
.stack { display: grid; gap: 1rem; }`,
    body: `<main>
  <div class="top">
    <h1 style="margin:0">My wallet</h1>
    <ou-wallet-connect show-balance></ou-wallet-connect>
  </div>
  <div class="grid" style="margin-top:1.5rem">
    <div class="stack">
      <ou-balance-card balance="2450000" pending="21000" fiat-currency="USD" fiat-price="97250">
        <div slot="actions"><ou-button>Send</ou-button><ou-button variant="secondary">Receive</ou-button></div>
      </ou-balance-card>
      <div class="card stack">
        <strong>Send</strong>
        <ou-address-input label="To" accept="onchain-address,bip21"></ou-address-input>
        <ou-amount-input label="Amount" balance="2450000" fiat-currency="USD" fiat-price="97250"></ou-amount-input>
        <ou-fee-selector id="fees" vsize="141" fiat-currency="USD" fiat-price="97250"></ou-fee-selector>
        <ou-button block>Review transaction</ou-button>
      </div>
    </div>
    <div class="card">
      <strong>Activity</strong>
      <ou-transaction-list id="txs" interactive></ou-transaction-list>
    </div>
  </div>
</main>`,
    script: `const now = Date.now();
document.querySelector('#fees').fees = { fastestFee: 24, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 };
document.querySelector('#txs').transactions = [
  { id: 'a', direction: 'incoming', amount: 21000, timestamp: now - 300000, method: 'lightning', label: 'Zap from Alice' },
  { id: 'b', direction: 'outgoing', amount: 150000, fee: 1410, timestamp: now - 7200000, status: 'pending', confirmations: 2 },
  { id: 'c', direction: 'incoming', amount: 1250000, timestamp: now - 86400000 * 1.5, label: 'Salary' },
  { id: 'd', direction: 'outgoing', amount: 99000, timestamp: now - 86400000 * 9, method: 'lightning', label: 'VPN subscription' },
];`,
  },
];

const CDN = 'https://cdn.jsdelivr.net/npm/@orange-ui/elements/dist/cdn/orange-ui.js';

/** A standalone, copyable HTML file for a template. */
export function templateSource(t: Template): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t.title}</title>
  <script type="module" src="${CDN}"></script>
  <style>
${t.css}
  </style>
</head>
<body>
${t.body}
${t.script ? `<script type="module">\n${t.script}\n</script>\n` : ''}<!-- adapter="mock" simulates payments. Replace it with your adapter: https://github.com/yantra-commons/BITKIT -->
</body>
</html>
`;
}
