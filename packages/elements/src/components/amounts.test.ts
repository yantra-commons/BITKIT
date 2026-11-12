import { afterEach, describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture } from '../../test/helpers.js';
import '../index.js';
import { configure } from '../internal/config.js';
import type { OuAmountDisplay, OuAmountInput } from '../index.js';

const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim();

afterEach(() => configure({ unit: 'sats', fiatRate: undefined, locale: undefined }));

describe('ou-amount-display', () => {
  it('formats sats with a screen-reader label', async () => {
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="12345"></ou-amount-display>',
    );
    expect(text(el, '.value')).toBe('12,345 sats');
    expect(text(el, '.sr-only')).toBe('12,345 sats');
    await expectAccessible(el);
  });

  it('supports BTC, symbol style and msat precision', async () => {
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="250000" unit="btc" btc-style="symbol"></ou-amount-display>',
    );
    expect(text(el, '.value')).toBe('₿0.0025');
    expect(text(el, '.sr-only')).toBe('0.0025 bitcoin');
    el.msat = 1500n;
    el.unit = 'sats';
    await el.updateComplete;
    expect(text(el, '.value')).toBe('1 sat');
  });

  it('shows fiat and cycles units on click', async () => {
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="10000" toggle show-fiat fiat-currency="USD" fiat-price="60000"></ou-amount-display>',
    );
    expect(text(el, '.fiat')).toContain('$6.00');
    const spy = vi.fn();
    el.addEventListener('ou-unit-change', spy);
    const btn = $<HTMLButtonElement>(el, 'button.toggle');
    expect(btn.getAttribute('aria-label')).toBe('10,000 sats. Change unit');
    btn.click();
    await el.updateComplete;
    expect(el.unit).toBe('btc');
    $<HTMLButtonElement>(el, 'button.toggle').click();
    await el.updateComplete;
    expect(el.unit).toBe('fiat');
    expect(text(el, '.value')).toBe('$6.00');
    expect(text(el, '.fiat')).toBe('10,000 sats');
    $<HTMLButtonElement>(el, 'button.toggle').click();
    await el.updateComplete;
    expect(el.unit).toBe('sats');
    expect(spy).toHaveBeenCalledTimes(3);
    await expectAccessible(el);
  });

  it('hides amounts in privacy mode', async () => {
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="5000" privacy-toggle show-fiat fiat-currency="EUR" fiat-price="50000"></ou-amount-display>',
    );
    const spy = vi.fn();
    el.addEventListener('ou-privacy-change', spy);
    $<HTMLButtonElement>(el, '.eye').click();
    await el.updateComplete;
    expect(el.privacy).toBe(true);
    expect(text(el, '.value')).toBe('•••••');
    expect(text(el, '.sr-only')).toBe('Amount hidden');
    expect($(el, '.fiat')).toBeNull();
    expect($(el, '.eye').getAttribute('aria-pressed')).toBe('true');
    expect(spy.mock.calls[0]![0].detail).toEqual({ hidden: true });
    await expectAccessible(el);
  });

  it('respects global config, locales, empty and loading states', async () => {
    configure({ unit: 'btc' });
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="150000" locale="de-DE"></ou-amount-display>',
    );
    expect(text(el, '.value')).toBe('0,0015 BTC');
    el.amount = undefined;
    await el.updateComplete;
    expect(text(el, '.value')).toBe('—');
    el.loading = true;
    await el.updateComplete;
    expect($(el, 'ou-skeleton')).not.toBeNull();
  });

  it('ignores invalid attributes gracefully', async () => {
    const el = await fixture<OuAmountDisplay>(
      '<ou-amount-display amount="abc"></ou-amount-display>',
    );
    expect(text(el, '.value')).toBe('—');
  });
});

async function type(el: OuAmountInput, value: string) {
  const input = $<HTMLInputElement>(el, 'input');
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
}

async function blur(el: OuAmountInput) {
  const input = $<HTMLInputElement>(el, 'input');
  input.dispatchEvent(new Event('change'));
  input.dispatchEvent(new Event('blur'));
  await el.updateComplete;
  await el.updateComplete;
}

describe('ou-amount-input', () => {
  it('parses sats exactly and emits details', async () => {
    const el = await fixture<OuAmountInput>('<ou-amount-input label="Amount"></ou-amount-input>');
    const spy = vi.fn();
    el.addEventListener('ou-input', spy);
    await type(el, '21,000');
    await el.updateComplete;
    expect(el.amount).toBe(21000n);
    expect(el.msat).toBe(21_000_000n);
    expect(spy.mock.calls.at(-1)![0].detail).toMatchObject({
      amount: 21000n,
      valid: true,
      unit: 'sats',
    });
    await expectAccessible(el);
  });

  it('switches to BTC and converts the current value', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" amount="250000"></ou-amount-input>',
    );
    expect($<HTMLInputElement>(el, 'input').value).toBe('250000');
    const select = $<HTMLSelectElement>(el, 'select.unit');
    select.value = 'btc';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.unit).toBe('btc');
    expect($<HTMLInputElement>(el, 'input').value).toBe('0.0025');
    await type(el, '0.00000001');
    expect(el.amount).toBe(1n);
    await type(el, '0.000000001');
    await blur(el);
    expect(el.amount).toBeUndefined();
    expect(text(el, '.error')).toContain('8 decimal places');
  });

  it('enters fiat and previews sats', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" unit="fiat" fiat-currency="USD" fiat-price="60000"></ou-amount-input>',
    );
    await type(el, '6');
    expect(el.amount).toBe(10000n);
    expect(text(el, '.below')).toContain('≈ 10,000 sats');
    const select = $<HTMLSelectElement>(el, 'select.unit');
    expect([...select.options].map((o) => o.textContent)).toEqual(['sats', 'BTC', 'USD']);
    select.value = 'sats';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(text(el, '.below')).toContain('≈ $6.00');
  });

  it('validates min, max and balance with clear messages', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" min="1000" max="100000" balance="50000"></ou-amount-input>',
    );
    await type(el, '10');
    await blur(el);
    expect(el.invalid).toBe(true);
    expect(text(el, '.error')).toBe('The minimum is 1,000 sats.');
    await type(el, '60000');
    expect(text(el, '.error')).toBe('Not enough funds. Available: 50,000 sats.');
    el.balance = undefined;
    await type(el, '200000');
    expect(text(el, '.error')).toBe('The maximum is 100,000 sats.');
    await type(el, '-5');
    expect(text(el, '.error')).toBe('Enter a valid amount.');
    await type(el, 'abc');
    expect(text(el, '.error')).toBe('Enter a valid amount.');
    await type(el, '1.5');
    expect(text(el, '.error')).toBe('Enter a whole number of sats.');
  });

  it('fills the balance with Max', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" balance="123456" unit="fiat" fiat-currency="USD" fiat-price="60000"></ou-amount-input>',
    );
    const spy = vi.fn();
    el.addEventListener('ou-change', spy);
    expect(text(el, '.avail')).toContain('Available: 123,456 sats');
    $<HTMLButtonElement>(el, '.max').click();
    await el.updateComplete;
    await el.updateComplete;
    expect(el.amount).toBe(123456n); // exact, not the rounded fiat value
    expect($<HTMLInputElement>(el, 'input').value).toBe('74.07');
    expect(spy.mock.calls.at(-1)![0].detail.amount).toBe(123456n);
  });

  it('accepts locale formatted input and msat when allowed', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Betrag" locale="de-DE" unit="btc"></ou-amount-input>',
    );
    await type(el, '0,001');
    expect(el.amount).toBe(100000n);
    el.allowMsat = true;
    el.unit = 'sats';
    await el.updateComplete;
    await type(el, '1,5');
    expect(el.msat).toBe(1500n);
  });

  it('requires a value when required', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" required></ou-amount-input>',
    );
    await blur(el);
    expect(el.invalid).toBe(true);
    expect(text(el, '.error')).toBe('Enter a valid amount.');
  });

  it('hides fiat when no rate is set and shows a static unit for one option', async () => {
    const el = await fixture<OuAmountInput>(
      '<ou-amount-input label="Amount" unit="fiat"></ou-amount-input>',
    );
    expect(el.unit).toBe('sats');
    el.units = ['sats'];
    await el.updateComplete;
    expect($(el, 'select.unit')).toBeNull();
    expect(text(el, '.unit-static')).toBe('sats');
  });
});
