import { expect, test } from '@playwright/test';
import { SITE } from './site';

// Runs in the `mobile` project (Pixel 7 viewport): no horizontal scrolling anywhere.
for (const url of [
  SITE,
  `${SITE}templates/wallet-dashboard/`,
  `${SITE}docs/components/checkout/`,
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
