import { expect, test } from '@playwright/test';

// Runs in the `mobile` project (Pixel 7 viewport): no horizontal scrolling anywhere.
for (const url of [
  'http://localhost:4400/bitkit-ui/',
  'http://localhost:4400/bitkit-ui/templates/wallet-dashboard/',
  'http://localhost:4400/bitkit-ui/docs/components/checkout/',
  'http://localhost:4310/',
]) {
  test(`no horizontal overflow: ${url}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
