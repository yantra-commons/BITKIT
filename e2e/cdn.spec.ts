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
    // Where focus is: inside the dialog, in browser UI (activeElement falls back to body), or
    // on page content behind the dialog, which must never happen.
    const focusAt = () =>
      page.evaluate(() => {
        let el: Element | null = document.activeElement;
        while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
        if (!el || el === document.body || el === document.documentElement) return 'browser';
        return el.closest('ou-dialog, dialog') || el.getRootNode() !== document ? 'dialog' : 'page';
      });
    // Focus moves into the dialog a frame after it opens in some engines.
    await expect.poll(focusAt).toBe('dialog');
    // Native modal dialogs let Tab reach the browser's own UI (by design), but never the page.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await focusAt()).not.toBe('page');
    }
    // Escape only reaches the dialog when focus is in the page, so tab back in if needed.
    for (let i = 0; i < 5 && (await focusAt()) !== 'dialog'; i++) await page.keyboard.press('Tab');
    expect(await focusAt()).toBe('dialog');
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
