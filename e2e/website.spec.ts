import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';
import { SITE } from './site';

const BASE = SITE;

test.describe('website', () => {
  test('landing hero checkout works end to end on the mock adapter', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('UI kit for');
    const checkout = page.locator('#hero-checkout');
    await expect(checkout.getByText('Demo payment on signet')).toBeVisible();
    await expect(checkout.getByText('Payment received')).toBeVisible({ timeout: 15_000 });

    // Scenario chips drive the mock: on-chain shows confirmations.
    await page.getByRole('button', { name: 'On-chain' }).click();
    await expect(checkout.getByText('Confirming payment')).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('component page renders demo, code tabs and API tables', async ({ page }) => {
    await page.goto(`${BASE}docs/components/amount-input/`);
    await expect(page.getByRole('heading', { name: '<ou-amount-input>' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await page.getByRole('tab', { name: 'React' }).first().click();
    await expect(
      page.getByText("import { AmountInput } from '@orange-ui/react';").first(),
    ).toBeVisible();
    const input = page.locator('.ou-demo__preview ou-amount-input input');
    await input.fill('500');
    await input.blur();
    await expect(page.locator('.ou-demo__preview ou-amount-input')).toContainText(
      'The minimum is 1,000 sats.',
    );
  });

  test('playground generates code for the chosen props', async ({ page }) => {
    await page.goto(`${BASE}playground/?c=amount-display`);
    await page.getByLabel('unit', { exact: true }).selectOption('btc');
    await expect(page.locator('#pg-code')).toContainText('unit="btc"');
    await expect(page.locator('#pg-preview ou-amount-display')).toContainText('BTC');
    await page.getByRole('tab', { name: 'Vue' }).click();
    await expect(page.locator('#pg-code')).toContainText(':amount="1234567n"');
  });

  test('theme builder exports changed tokens', async ({ page }) => {
    await page.goto(`${BASE}theme-builder/`);
    await page.getByLabel('Start from a preset').selectOption('lightning');
    await expect(page.locator('#tb-css')).toContainText('--ou-color-accent: #7B3FE4');
  });

  for (const path of [
    '',
    'docs/',
    'docs/components/checkout/',
    'docs/guides/security/',
    'templates/donation/',
  ]) {
    test(`a11y: /${path}`, async ({ page }) => {
      await page.goto(BASE + path);
      await page.waitForTimeout(800);
      // Starlight's own search dialog is out of scope; Expressive Code renders its own copy buttons.
      await expectNoA11yViolations(page, { exclude: ['site-search', '.expressive-code'] });
    });
  }
});
