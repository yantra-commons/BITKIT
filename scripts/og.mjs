// Render apps/website/public/og.png (1200×630) from HTML. Re-run after renaming the kit.
//   node scripts/og.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const kit = JSON.parse(readFileSync(new URL('../kit.config.json', import.meta.url), 'utf8'));
const logo = readFileSync(new URL('../apps/website/src/assets/logo.svg', import.meta.url), 'utf8');

const html = `<!doctype html><html><head><style>
  body { margin: 0; width: 1200px; height: 630px; font-family: system-ui, 'Segoe UI', sans-serif;
    background: radial-gradient(circle at 85% 20%, rgba(247,147,26,.35), transparent 45%), #0e0e11; color: #f3f3f6;
    display: flex; flex-direction: column; justify-content: center; padding: 0 96px; box-sizing: border-box; }
  .brand { display: flex; align-items: center; gap: 20px; font-size: 40px; font-weight: 700; }
  .brand svg { width: 72px; height: 72px; }
  h1 { font-size: 76px; line-height: 1.05; margin: 40px 0 24px; letter-spacing: -2px; font-weight: 800; }
  h1 em { font-style: normal; color: #ffa640; }
  p { font-size: 30px; color: #a3a3ae; margin: 0; }
  .chips { display: flex; gap: 14px; margin-top: 40px; }
  .chips span { border: 1px solid #33333d; border-radius: 999px; padding: 10px 22px; font-size: 22px; color: #f3f3f6; }
</style></head><body>
  <div class="brand">${logo}<span>${kit.displayName}</span></div>
  <h1>The UI kit for <em>Bitcoin</em> apps.</h1>
  <p>Accessible web components for amounts, addresses, invoices and payments.</p>
  <div class="chips"><span>Web Components</span><span>React</span><span>Vue</span><span>Lightning</span><span>MIT</span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({
  path: fileURLToPath(new URL('../apps/website/public/og.png', import.meta.url)),
});
await browser.close();
console.log('og.png written');
