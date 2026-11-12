/**
 * Builds /llms.txt (a short index, per https://llmstxt.org) and /llms-full.txt (the complete
 * API reference) for AI coding assistants. Everything component-specific is generated from
 * custom-elements.json, so these files cannot drift from the code.
 */
import kit from '../../../../kit.config.json';
import { components, type ComponentDoc } from './manifest';
import { examples } from './examples';
import { templates } from './templates';

const SITE = `${kit.siteUrl}${kit.siteBase}`;
const page = (path: string) => `${SITE}/${path}`;
const oneLine = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const typeText = (t?: { text?: string }) => (t?.text ?? '').replace(/\s*\|\s*undefined$/, '');
/** Markdown table cells: union types like `'a' | 'b'` would otherwise split the row. */
const cell = (s: string) => s.replace(/\|/g, '\\|');
const summaryOf = (c: ComponentDoc) => c.summary.replace(/^SECURITY-SENSITIVE\.\s*/, '');
const eventSuffix = (name: string) =>
  name
    .replace(/^bk-/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

const GROUPS: Record<string, string[]> = {
  Payments: [
    'pay-button',
    'checkout',
    'invoice-display',
    'payment-status',
    'donation-widget',
    'lightning-address-card',
  ],
  Amounts: ['amount-display', 'amount-input'],
  Addresses: ['address-display', 'address-input', 'qr-scanner', 'network-badge'],
  Wallet: [
    'wallet-connect',
    'balance-card',
    'transaction-list',
    'transaction-item',
    'confirmation-progress',
    'fee-selector',
    'utxo-list',
  ],
  'Security-sensitive (recovery phrases)': ['mnemonic-display', 'mnemonic-input', 'backup-check'],
  Primitives: [
    'button',
    'icon-button',
    'icon',
    'input',
    'select',
    'dialog',
    'tooltip',
    'toast',
    'toaster',
    'tabs',
    'badge',
    'spinner',
    'skeleton',
    'copy-button',
    'qr-code',
  ],
};

function grouped(): [string, ComponentDoc[]][] {
  const bySlug = new Map(components.map((c) => [c.slug, c]));
  const seen = new Set<string>();
  const out: [string, ComponentDoc[]][] = Object.entries(GROUPS).map(([label, slugs]) => [
    label,
    slugs.flatMap((s) => {
      const c = bySlug.get(s);
      if (!c) return [];
      seen.add(s);
      return [c];
    }),
  ]);
  const rest = components.filter((c) => !seen.has(c.slug));
  if (rest.length) out.push(['Other', rest]);
  return out;
}

const DOCS: [string, string, string][] = [
  ['Installation', 'docs/getting-started/installation/', 'packages, registration, configure()'],
  ['Plain HTML (CDN)', 'docs/getting-started/html/', 'one script tag, no build step'],
  ['React', 'docs/getting-started/react/', 'typed wrappers, events as on* props, refs'],
  ['Vue', 'docs/getting-started/vue/', 'typed wrappers, isCustomElement config'],
  ['Next.js', 'docs/getting-started/nextjs/', "'use client', Route Handler proxy"],
  ['Astro', 'docs/getting-started/astro/', 'client-side islands'],
  ['Theming', 'docs/guides/theming/', '--bk-* tokens, dark mode, ::part()'],
  ['Payment adapters', 'docs/guides/adapters/', 'PaymentAdapter interface and providers'],
  ['Server proxy pattern', 'docs/guides/server-proxy/', 'keep provider API keys server-side'],
  ['Wallet connections', 'docs/guides/wallets/', 'WebLN, NWC, Bitcoin Connect'],
  ['Headless core', 'docs/guides/core/', 'amounts, address/invoice parsing without UI'],
  ['Security model', 'docs/guides/security/', 'guarantees and threat model'],
  ['Accessibility', 'docs/guides/accessibility/', 'WCAG 2.2 AA notes'],
  ['Localization', 'docs/guides/localization/', 'locales and string overrides'],
];

const RULES = `## Rules for generated code

Follow these when writing code that uses ${kit.displayName}. They prevent the most common mistakes.

1. **Amounts are \`bigint\` sats on components.** \`amount\`, \`balance\`, \`min\`, \`max\` and
   similar take bigint sats: \`amount={21000n}\` in JSX, \`el.amount = 21000n\` in JS,
   \`amount="21000"\` as an HTML attribute. Use the \`msat\` property only when you need
   millisatoshi precision. \`@bitkit-ui/core\` works in **msat** (\`toMsat\`, \`fromMsat\`).
2. **Never use floating point for money.** No \`parseFloat\`, \`Number()\`, \`toFixed\` or
   \`Math.*\` on amounts. Convert with \`toMsat('0.0025', 'btc')\` and fiat with
   \`fiatToMsat\` / \`msatToFiat\`, passing exact decimal strings (\`price: '97250'\`).
3. **Use \`adapter="mock"\` for demos.** It runs on signet and produces unpayable invoices, so no
   real bitcoin can be sent. For real payments, use \`createHttpAdapter({ baseUrl: '/api/payments' })\`
   in the browser and a provider adapter (BTCPay, LNbits, OpenNode) on your server.
4. **Never put a provider API key in browser code.** Adapters throw if given \`apiKey\` in a
   browser. Keep keys in server env vars behind your own API (see the server proxy pattern).
5. **\`bk-paid\` only updates the UI.** Fulfil orders on the server after the provider's webhook or
   an authenticated status check. Take the price from your database, not from the browser.
6. **Pass recovery phrases as a JS property, never an HTML attribute**
   (\`el.words = [...]\`). Don't log them, store them or send them over the network.
7. **Events** are named \`bk-<verb>\` and carry \`event.detail\`. They bubble and are composed.
   React: \`bk-status-change\` → \`onStatusChange\` (receives the \`CustomEvent\`). Vue:
   \`@status-change\`. Plain JS: \`addEventListener('bk-status-change', …)\`.
8. **SSR:** importing the components on the server is safe, but payment components create
   invoices when they mount, so render them client-side (\`'use client'\` in Next.js,
   \`<ClientOnly>\` in Nuxt, \`client:only\` / \`client:load\` in Astro).
9. **Style with \`--bk-*\` CSS variables and \`::part()\`.** Don't hard-code colors.
   \`data-bk-theme="dark"\` / \`"light"\` forces a theme. By default components follow
   \`prefers-color-scheme\`.
10. **Copy:** write "bitcoin" in lowercase for the unit, and use "sats", "Lightning invoice" and
    "on-chain" (Bitcoin Design Guide terms).
`;

const QUICKSTART = `## Quickstart

### No build step (CDN)

\`\`\`html
<script type="module" src="https://cdn.jsdelivr.net/npm/@bitkit-ui/elements/dist/cdn/bitkit-ui.js"></script>
<bk-pay-button amount="21000" adapter="mock" description="Flat white"></bk-pay-button>
<script type="module">
  document.addEventListener('bk-paid', (e) => console.log('paid', e.detail.invoice.id));
</script>
\`\`\`

Pin a version in production: \`@bitkit-ui/elements@0.1.0/dist/cdn/bitkit-ui.js\`. The CDN module
also exports \`registerAdapter\`, \`createHttpAdapter\`, \`configure\` and \`toast\`.

### npm

\`\`\`sh
npm install @bitkit-ui/elements @bitkit-ui/adapters   # web components
npm install @bitkit-ui/react @bitkit-ui/adapters      # React 18/19 wrappers
npm install @bitkit-ui/vue @bitkit-ui/adapters        # Vue 3 wrappers
npm install @bitkit-ui/core                           # headless logic only, no DOM
\`\`\`

\`\`\`ts
import '@bitkit-ui/elements';              // registers every <bk-*> element
import '@bitkit-ui/elements/checkout';     // or one component (smaller bundle)
import { configure } from '@bitkit-ui/elements';
configure({ network: 'mainnet', unit: 'sats', locale: 'en-US', fiatRate: { currency: 'USD', price: '97250' } });
\`\`\`

### React

\`\`\`tsx
'use client';
import { useMemo } from 'react';
import { Checkout } from '@bitkit-ui/react';
import { createHttpAdapter } from '@bitkit-ui/adapters/http';

export function Pay() {
  const adapter = useMemo(() => createHttpAdapter({ baseUrl: '/api/payments' }), []);
  return <Checkout adapter={adapter} amount={21000n} description="Order #1042"
    onPaid={(e) => console.log(e.detail.invoice.id)} />;
}
\`\`\`

Each React and Vue component is named after its tag in PascalCase, without the \`bk-\` prefix
(\`<bk-amount-input>\` → \`AmountInput\`).

### Vue

\`\`\`vue
<script setup lang="ts">
import { MockAdapter } from '@bitkit-ui/adapters/mock';
import { Checkout } from '@bitkit-ui/vue';
const adapter = new MockAdapter();
</script>
<template>
  <Checkout :adapter="adapter" :amount="21000n" @paid="(e) => console.log(e.detail.invoice.id)" />
</template>
\`\`\`

In \`vite.config.ts\`, set \`vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('bk-') } } })\`
if you also use raw \`<bk-*>\` tags in templates.

### Next.js

Add \`transpilePackages: ['@bitkit-ui/react', '@bitkit-ui/elements', '@bitkit-ui/adapters', '@bitkit-ui/core']\`
to \`next.config.mjs\`. Use the wrappers from a \`'use client'\` component, and create invoices in
\`app/api/payments/route.ts\` (POST) and \`app/api/payments/[id]/route.ts\` (GET status) with a
server-side adapter.
`;

const ADAPTERS = `## Payment adapters (\`@bitkit-ui/adapters\`)

\`\`\`ts
interface PaymentAdapter {
  readonly name: string;
  createInvoice(req: CreateInvoiceRequest, opts?: { signal?: AbortSignal }): Promise<Invoice>;
  getStatus(invoiceId: string): Promise<PaymentUpdate>;
  subscribe(invoiceId: string, onUpdate: (u: PaymentUpdate) => void): () => void;
  cancel(invoiceId: string): Promise<void>;
}
interface CreateInvoiceRequest {
  amountSats?: bigint;           // or fiat
  fiat?: { currency: string; amount: string };
  description?: string; orderId?: string; metadata?: Record<string, string>;
  methods?: ('lightning' | 'onchain')[]; expirySeconds?: number;
}
interface Invoice {
  id: string; amountSats: bigint; description?: string;
  lightning?: string;                         // BOLT11
  onchain?: { address: string; uri?: string };
  network: 'mainnet' | 'testnet' | 'signet' | 'regtest';
  status: PaymentStatus; createdAt: number; expiresAt?: number; checkoutUrl?: string; mock?: boolean;
}
interface PaymentUpdate {
  invoiceId: string; status: PaymentStatus; method?: 'lightning' | 'onchain';
  amountReceivedSats?: bigint; confirmations?: number; requiredConfirmations?: number;
  txid?: string; preimage?: string; updatedAt: number;
}
type PaymentStatus = 'pending' | 'detected' | 'confirming' | 'paid' | 'underpaid'
  | 'overpaid' | 'expired' | 'failed' | 'cancelled';
\`\`\`

| Adapter | Import | In the browser? |
| --- | --- | --- |
| Mock (\`new MockAdapter({ scenario })\`; scenarios: lightning, onchain, underpaid, overpaid, expired, failed, manual) | \`@bitkit-ui/adapters/mock\` | Yes (demo only) |
| HTTP (\`createHttpAdapter({ baseUrl, sse? })\`) | \`@bitkit-ui/adapters/http\` | Yes, recommended |
| BTCPay Server (\`new BtcPayAdapter({ baseUrl, storeId, apiKey })\`) | \`@bitkit-ui/adapters/btcpay\` | Server only |
| LNbits (\`new LnbitsAdapter({ baseUrl, apiKey })\`) | \`@bitkit-ui/adapters/lnbits\` | Server only |
| OpenNode (\`new OpenNodeAdapter({ apiKey })\`) | \`@bitkit-ui/adapters/opennode\` | Server only |
| Nostr Wallet Connect (\`new NwcAdapter({ client })\`) | \`@bitkit-ui/adapters/nwc\` | Only with a receive-only connection |

**HTTP adapter contract:** your server implements \`POST {baseUrl}\` (JSON
\`CreateInvoiceRequest\` → \`Invoice\`, 201), \`GET {baseUrl}/:id\` (→ \`PaymentUpdate\`) and,
optionally, \`GET {baseUrl}/:id/events\` (server-sent events of \`PaymentUpdate\`). bigint fields
travel as JSON strings (\`"21000"\`). Serialize them with
\`JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x)\`.

To use a named adapter from HTML attributes, register it:
\`registerAdapter('store', createHttpAdapter({ baseUrl: '/api/payments' }))\`, then write
\`<bk-pay-button adapter="store">\`. \`"mock"\` is pre-registered in the CDN build.

Rates and fees: \`new MempoolRates({ baseUrl: 'https://mempool.space/api' })\` gives
\`getRate('USD')\` → \`{ currency, price }\` (price is a decimal string) and
\`getRecommendedFees()\`.

To write your own adapter, implement the interface. \`pollStatus\` from \`@bitkit-ui/adapters\` turns
\`getStatus\` into \`subscribe\`.
`;

const CORE = `## Headless core (\`@bitkit-ui/core\`)

Pure TypeScript with no DOM. It runs in browsers, Node, Deno, Bun and workers. All amounts are
bigint **msat**.

\`\`\`ts
import { toMsat, fromMsat, formatAmount, fiatToMsat, msatToFiat, parsePaymentInput } from '@bitkit-ui/core';
toMsat('0.0025', 'btc');                               // 250000000n
fromMsat(250000000n, 'sat');                           // "250000"
formatAmount(msat, { unit: 'auto', locale: 'en-US' }).text;
msatToFiat(msat, { currency: 'USD', price: '97250' }).value;

const r = parsePaymentInput(pastedText, { network: 'mainnet' });
// r.type: 'onchain-address' | 'bip21' | 'bolt11' | 'bolt12-offer' | 'lnurl' | 'lightning-address' | 'invalid'
\`\`\`

Also: \`decodeAddress\`, \`validateAddress\`, \`parseBip21\`, \`buildBip21\`, \`decodeBolt11\`
(display only: it does **not** verify signatures), \`decodeLnurl\`, \`encodeLnurl\`,
\`parseLightningAddress\`, \`decodeBolt12Offer\`, \`parseNwcUri\`, \`estimateVsize\`,
\`feeForVsize\`, \`feeTiersFromRecommended\`, \`checkFeeRate\`, and BIP39 helpers in
\`@bitkit-ui/core/mnemonic\`. Functions that fail throw \`BitkitError\` with a stable \`code\` and
a user-facing \`message\`. Most have a non-throwing \`validate*\` variant.
`;

const THEMING = `## Theming

\`\`\`css
:root {
  --bk-color-accent: #7b3fe4;
  --bk-color-on-accent: #ffffff;
  --bk-radius-md: 4px;
  --bk-font-sans: 'Inter', system-ui, sans-serif;
}
[data-bk-theme='dark'] { --bk-color-accent: #a77bff; }
bk-checkout::part(base) { box-shadow: none; }
\`\`\`

Token groups: color (\`--bk-color-bg\`, \`surface\`, \`text\`, \`text-muted\`, \`border\`,
\`accent\`, \`on-accent\`, \`success\`, \`warning\`, \`danger\`, \`info\`, \`focus\`, \`qr-fg\`,
\`qr-bg\`), type (\`--bk-font-*\`), space (\`--bk-space-1…10\`), shape (\`--bk-radius-*\`,
\`--bk-control-height-*\`, \`--bk-shadow-*\`) and motion (\`--bk-duration-*\`). Each component's
CSS parts are listed below.
`;

function componentSection(c: ComponentDoc): string {
  const lines: string[] = [];
  lines.push(`### <${c.tag}>`, '');
  lines.push(oneLine(summaryOf(c)), '');
  if (c.security) {
    lines.push(
      '**Security-sensitive:** handles a recovery phrase. Never log, persist or transmit the words, and never put them in an HTML attribute (set them as a JS property).',
      '',
    );
  }
  lines.push(
    `Import: \`import '@bitkit-ui/elements/${c.slug}'\` · React: \`${c.name}\` from \`@bitkit-ui/react\` · Vue: \`${c.name}\` from \`@bitkit-ui/vue\` · Docs: ${page(`docs/components/${c.slug}/`)}`,
    '',
  );

  const attrFields = new Set(c.attributes.map((a) => a.fieldName ?? a.name));
  const propByName = new Map(c.properties.map((p) => [p.name, p]));
  if (c.attributes.length) {
    lines.push(
      '| Attribute | Property | Type | Default | Description |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const a of c.attributes) {
      const prop = propByName.get(a.fieldName ?? '');
      const desc = oneLine(a.description ?? prop?.description);
      const def = a.default ?? prop?.default ?? '';
      lines.push(
        `| \`${a.name}\` | \`${a.fieldName ?? ''}\` | \`${cell(typeText(a.type ?? prop?.type))}\` | ${def ? `\`${cell(oneLine(def))}\`` : ''} | ${cell(desc)} |`,
      );
    }
    lines.push('');
  }
  const propOnly = c.properties.filter((p) => !attrFields.has(p.name) && p.name !== 'data');
  if (propOnly.length) {
    lines.push('Properties (JS only, no attribute):', '');
    for (const p of propOnly) {
      lines.push(
        `- \`${p.name}: ${typeText(p.type)}\`${p.description ? ` — ${oneLine(p.description)}` : ''}`,
      );
    }
    lines.push('');
  }
  if (c.methods.length) {
    lines.push('Methods:', '');
    for (const m of c.methods) {
      const params = (m.parameters ?? []).map(
        (p) => `${p.name}${p.type?.text ? `: ${p.type.text}` : ''}`,
      );
      lines.push(
        `- \`${m.name}(${params.join(', ')})\`${m.description ? ` — ${oneLine(m.description)}` : ''}`,
      );
    }
    lines.push('');
  }
  if (c.events.length) {
    lines.push('Events:', '');
    for (const e of c.events) {
      const react = e.name.startsWith('bk-')
        ? ` (React \`on${eventSuffix(e.name)}\`, Vue \`@${e.name.slice(3)}\`)`
        : '';
      lines.push(`- \`${e.name}\`${react}${e.description ? ` — ${oneLine(e.description)}` : ''}`);
    }
    lines.push('');
  }
  if (c.slots.length) {
    lines.push(
      `Slots: ${c.slots.map((s) => `\`${s.name || '(default)'}\`${s.description ? ` (${oneLine(s.description)})` : ''}`).join(', ')}`,
      '',
    );
  }
  if (c.cssParts.length) {
    lines.push(`CSS parts: ${c.cssParts.map((p) => `\`${p.name}\``).join(', ')}`, '');
  }
  const ex = examples[c.slug];
  if (ex) {
    lines.push('```html', ex.html, '```', '');
    if (ex.js) lines.push('```js', ex.js, '```', '');
  }
  return lines.join('\n');
}

const HEADER = `# ${kit.displayName}

> Open-source, MIT-licensed web components for Bitcoin and Lightning web apps: amounts, addresses,
> invoices, checkout and payments, wallets, transactions and fees. The components are framework-agnostic
> (Lit custom elements, \`<bk-*>\` tags) and ship with typed React and Vue wrappers, a headless
> TypeScript core and a pluggable payment adapter layer. They use exact bigint money math, meet
> WCAG 2.2 AA, are non-custodial and never put secret API keys in the browser.
`;

export function llmsIndex(): string {
  const out: string[] = [HEADER];
  out.push(
    `Packages: \`@bitkit-ui/elements\` (web components), \`@bitkit-ui/react\`, \`@bitkit-ui/vue\`, \`@bitkit-ui/adapters\` (payment providers), \`@bitkit-ui/core\` (headless logic), \`@bitkit-ui/tokens\` (CSS variables).`,
    '',
    'Key facts: component amounts are `bigint` sats (`21000n`); `@bitkit-ui/core` uses msat; use `adapter="mock"` for demos; keep provider API keys on a server and use `createHttpAdapter` in the browser; events are `bk-*` CustomEvents (React `on*`, Vue `@*`).',
    '',
    '## Docs',
    '',
    `- [Complete reference for LLMs](${page('llms-full.txt')}): every component, attribute, event and rule in one file`,
  );
  for (const [title, path, note] of DOCS) out.push(`- [${title}](${page(path)}): ${note}`);
  out.push('');
  for (const [label, list] of grouped()) {
    out.push(`## Components: ${label}`, '');
    for (const c of list)
      out.push(`- [<${c.tag}>](${page(`docs/components/${c.slug}/`)}): ${oneLine(summaryOf(c))}`);
    out.push('');
  }
  out.push('## Templates', '');
  for (const t of templates)
    out.push(`- [${t.title}](${page(`templates/${t.slug}/`)}): ${oneLine(t.description)}`);
  out.push(
    '',
    '## Optional',
    '',
    `- [Playground](${page('playground/')}): try components live`,
    `- [Theme builder](${page('theme-builder/')}): design a theme with contrast checks`,
    `- [Source code](https://github.com/${kit.repo})`,
    `- [Server proxy example](https://github.com/${kit.repo}/tree/main/apps/examples/proxy): a dependency-free invoice proxy`,
    '',
  );
  return out.join('\n');
}

export function llmsFull(): string {
  const out: string[] = [HEADER, RULES, QUICKSTART, ADAPTERS, CORE, THEMING, '## Components', ''];
  out.push(
    `${components.length} custom elements. Attribute values are strings in HTML. Set objects, arrays, adapters and bigints as JS properties (the framework wrappers do this for you).`,
    '',
  );
  for (const [label, list] of grouped()) {
    out.push(`## Components: ${label}`, '');
    for (const c of list) out.push(componentSection(c));
  }
  out.push('## Templates', '');
  for (const t of templates)
    out.push(`- **${t.title}** (${page(`templates/${t.slug}/`)}): ${oneLine(t.description)}`);
  out.push('', `Full docs: ${page('docs/')}`, '');
  return out.join('\n');
}
