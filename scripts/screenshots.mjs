// Capture screenshots of the built website (run `astro preview` first).
//   node scripts/screenshots.mjs <outDir> [baseUrl]
// Used for visual review, the README screenshot and docs/og image generation.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
const base = process.argv[3] ?? 'http://localhost:4400/BITKIT/';
mkdirSync(out, { recursive: true });

const pages = [
  ['landing-light', '', 'light', 1280, 2400, true],
  ['landing-dark', '', 'dark', 1280, 900, false],
  ['landing-mobile', '', 'light', 390, 844, false],
  ['checkout-doc', 'docs/components/checkout/', 'dark', 1280, 1300, false],
  ['amount-input-doc', 'docs/components/amount-input/', 'light', 1280, 1100, false],
  ['playground', 'playground/', 'light', 1280, 1000, false],
  ['theme-builder', 'theme-builder/', 'dark', 1280, 1000, false],
  ['templates', 'templates/', 'light', 1280, 1000, false],
  ['template-wallet', 'templates/wallet-dashboard/', 'light', 1280, 1000, false],
  ['template-checkout', 'templates/merchant-checkout/', 'dark', 1280, 900, false],
];

const browser = await chromium.launch();
const errors = [];
for (const [name, path, scheme, width, height, fullPage] of pages) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`);
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
