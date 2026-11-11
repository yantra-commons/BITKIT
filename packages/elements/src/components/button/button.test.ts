import { describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture } from '../../../test/helpers.js';
import './button.js';
import type { BkButton } from './button.js';

describe('bk-button', () => {
  it('renders an accessible button with its label', async () => {
    const el = await fixture<BkButton>('<bk-button>Pay now</bk-button>');
    const btn = $(el, 'button');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('primary');
    await expectAccessible(el);
  });

  it('blocks clicks while disabled or loading', async () => {
    const el = await fixture<BkButton>('<bk-button disabled>Pay</bk-button>');
    const spy = vi.fn();
    el.addEventListener('click', spy);
    $(el, 'button').click();
    expect(spy).not.toHaveBeenCalled();
    expect($(el, 'button').getAttribute('aria-disabled')).toBe('true');
    el.disabled = false;
    el.loading = true;
    await el.updateComplete;
    $(el, 'button').click();
    expect(spy).not.toHaveBeenCalled();
    expect(el.hasAttribute('aria-busy')).toBe(true);
    expect($(el, 'bk-spinner')).not.toBeNull();
  });

  it('submits its form when type=submit', async () => {
    const form = await fixture<HTMLFormElement>(
      '<form><bk-button type="submit">Go</bk-button></form>',
    );
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', onSubmit);
    const el = form.querySelector('bk-button')!;
    await el.updateComplete;
    $(el, 'button').click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders as a link with href', async () => {
    const el = await fixture<BkButton>(
      '<bk-button href="https://example.com" target="_blank">Docs</bk-button>',
    );
    const a = $<HTMLAnchorElement>(el, 'a');
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.getAttribute('rel')).toContain('noopener');
    await expectAccessible(el);
  });
});
