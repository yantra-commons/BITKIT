import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// Definition of done: a plain HTML file using the CDN build renders a working pay button
// with no build step. local.html is identical to index.html but loads the local bundle.
test.describe('plain HTML + CDN bundle', () => {
  test('pay button opens a checkout that completes on the mock adapter', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:4310/');

    await page.getByRole('button', { name: /pay with bitcoin/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay with bitcoin' });
    await expect(dialog).toBeVisible();
    // Checkout content is slotted into the dialog, so scope to the checkout element.
    const checkout = page.locator('ou-pay-button ou-checkout');
    await expect(checkout.getByText('Demo payment on signet')).toBeVisible();
    await expect(checkout.getByRole('img', { name: /QR code for payment request/ })).toBeVisible();
    await expect(checkout.getByRole('tab', { name: 'Lightning' })).toBeVisible();

    // The mock pays after ~3 s.
    await expect(checkout.getByText('Payment received')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#log')).toContainText('Paid invoice mock_');
    await checkout.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('dialog traps focus, closes on Escape and restores focus', async ({ page }) => {
    await page.goto('http://localhost:4310/');
    const opener = page.getByRole('button', { name: /pay with bitcoin/i });
    // Keyboard activation: WebKit (like Safari) does not focus buttons on mouse click, and focus
    // restoration is what keyboard users rely on.
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    // Focus never leaves the modal dialog.
    const inside = await page.evaluate(() => {
      let el: Element | null = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      return !!el?.closest('ou-dialog, dialog') || el?.getRootNode() !== document;
    });
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('donation widget is keyboard operable', async ({ page }) => {
    await page.goto('http://localhost:4310/');
    const group = page.getByRole('radiogroup', { name: 'Donation amount' });
    await group.getByRole('radio', { checked: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: /21,000 sats/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('button', { name: /Donate 21,000 sats/ })).toBeVisible();
  });

  test('page has no accessibility violations (incl. contrast)', async ({ page }) => {
    await page.goto('http://localhost:4310/');
    await page.waitForTimeout(500);
    await expectNoA11yViolations(page);
  });
});
