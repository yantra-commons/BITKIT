import { describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture } from '../../../test/helpers.js';
import './button.js';
import type { OuButton } from './button.js';

describe('ou-button', () => {
  it('renders an accessible button with its label', async () => {
    const el = await fixture<OuButton>('<ou-button>Pay now</ou-button>');
    const btn = $(el, 'button');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('primary');
    await expectAccessible(el);
  });

  it('blocks clicks while disabled or loading', async () => {
    const el = await fixture<OuButton>('<ou-button disabled>Pay</ou-button>');
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
    expect($(el, 'ou-spinner')).not.toBeNull();
  });

  it('submits its form when type=submit', async () => {
    const form = await fixture<HTMLFormElement>(
      '<form><ou-button type="submit">Go</ou-button></form>',
    );
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', onSubmit);
    const el = form.querySelector('ou-button')!;
    await el.updateComplete;
    $(el, 'button').click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders as a link with href', async () => {
    const el = await fixture<OuButton>(
      '<ou-button href="https://example.com" target="_blank">Docs</ou-button>',
    );
    const a = $<HTMLAnchorElement>(el, 'a');
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.getAttribute('rel')).toContain('noopener');
    await expectAccessible(el);
  });
});
