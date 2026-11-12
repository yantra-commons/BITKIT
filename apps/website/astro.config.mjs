import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const kit = JSON.parse(readFileSync(new URL('../../kit.config.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(
  readFileSync(new URL('../../packages/elements/custom-elements.json', import.meta.url), 'utf8'),
);

// Component pages are generated from the manifest; group them for the sidebar.
const GROUPS = {
  Primitives: [
    'button',
    'icon-button',
    'icon',
    'input',
    'select',
    'dialog',
    'tooltip',
    'toast',
    'tabs',
    'badge',
    'spinner',
    'skeleton',
    'copy-button',
    'qr-code',
  ],
  Amounts: ['amount-display', 'amount-input'],
  Addresses: ['address-display', 'address-input', 'qr-scanner', 'network-badge'],
  Payments: [
    'pay-button',
    'checkout',
    'invoice-display',
    'payment-status',
    'donation-widget',
    'lightning-address-card',
  ],
  Wallet: [
    'wallet-connect',
    'balance-card',
    'transaction-list',
    'transaction-item',
    'confirmation-progress',
    'fee-selector',
    'utxo-list',
  ],
  'Security-sensitive': ['mnemonic-display', 'mnemonic-input', 'backup-check'],
};
const tags = new Set(
  manifest.modules.flatMap((m) => (m.declarations ?? []).map((d) => d.tagName).filter(Boolean)),
);
const componentSidebar = Object.entries(GROUPS).map(([label, names]) => ({
  label,
  collapsed: label !== 'Payments',
  items: names
    .filter((n) => tags.has(`ou-${n}`))
    .map((n) => ({ label: `<ou-${n}>`, link: `/docs/components/${n}/` })),
}));

export default defineConfig({
  site: kit.siteUrl,
  base: kit.siteBase || '/',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: kit.displayName,
      description: 'Open-source UI components for Bitcoin and Lightning web apps.',
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: `https://github.com/${kit.repo}` }],
      editLink: { baseUrl: `https://github.com/${kit.repo}/edit/main/apps/website/` },
      customCss: ['./src/styles/starlight.css'],
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: `${kit.siteUrl}${kit.siteBase}/og.png` },
        },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      components: { ThemeProvider: './src/components/ThemeSync.astro' },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', link: '/docs/' },
            { label: 'Installation', link: '/docs/getting-started/installation/' },
            { label: 'Plain HTML (CDN)', link: '/docs/getting-started/html/' },
            { label: 'React', link: '/docs/getting-started/react/' },
            { label: 'Vue', link: '/docs/getting-started/vue/' },
            { label: 'Next.js', link: '/docs/getting-started/nextjs/' },
            { label: 'Astro', link: '/docs/getting-started/astro/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Theming', link: '/docs/guides/theming/' },
            { label: 'Payment adapters', link: '/docs/guides/adapters/' },
            { label: 'Server proxy pattern', link: '/docs/guides/server-proxy/' },
            { label: 'Wallet connections', link: '/docs/guides/wallets/' },
            { label: 'Localization', link: '/docs/guides/localization/' },
            { label: 'Accessibility', link: '/docs/guides/accessibility/' },
            { label: 'Security model', link: '/docs/guides/security/' },
            { label: 'Headless core', link: '/docs/guides/core/' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Accept bitcoin on a store page', link: '/docs/recipes/store-page/' },
            { label: 'Donation page', link: '/docs/recipes/donation-page/' },
            { label: 'Wallet dashboard', link: '/docs/recipes/wallet-dashboard/' },
          ],
        },
        { label: 'Components', items: componentSidebar },
        {
          label: 'Tools',
          items: [
            { label: 'Playground', link: '/playground/' },
            { label: 'Theme builder', link: '/theme-builder/' },
            { label: 'Templates', link: '/templates/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'FAQ', link: '/docs/reference/faq/' },
            { label: 'Migration & versioning', link: '/docs/reference/migration/' },
            { label: 'Contributing', link: '/docs/reference/contributing/' },
          ],
        },
      ],
    }),
  ],
});
