import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture, settle } from '../../test/helpers.js';
import '../index.js';
import { qrPath } from './qr-code/qr-code.js';
import { toast } from './toast/toast.js';
import type {
  OuBadge,
  OuCopyButton,
  OuDialog,
  OuIcon,
  OuIconButton,
  OuInput,
  OuQrCode,
  OuSelect,
  OuSkeleton,
  OuSpinner,
  OuTabs,
  OuToast,
  OuTooltip,
} from '../index.js';

describe('ou-icon', () => {
  it('is decorative by default and labelled when asked', async () => {
    const el = await fixture<OuIcon>('<ou-icon name="lightning"></ou-icon>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect($(el, 'svg')).not.toBeNull();
    el.label = 'Lightning';
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Lightning');
    await expectAccessible(el);
  });
});

describe('ou-spinner / ou-skeleton / ou-badge', () => {
  it('spinner announces a label', async () => {
    const el = await fixture<OuSpinner>('<ou-spinner label="Checking payment"></ou-spinner>');
    expect($(el, '[role=status]').textContent).toContain('Checking payment');
    await expectAccessible(el);
  });

  it('skeleton is hidden from assistive tech and sizes itself', async () => {
    const el = await fixture<OuSkeleton>('<ou-skeleton shape="circle" width="40px"></ou-skeleton>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect($(el, '.s').getAttribute('style')).toMatch(/height:s?40px/);
  });

  it('badge renders its variant', async () => {
    const el = await fixture<OuBadge>('<ou-badge variant="success">Paid</ou-badge>');
    expect($(el, '.b').className).toContain('success');
    await expectAccessible(el);
  });
});

describe('ou-icon-button', () => {
  it('uses its label as accessible name', async () => {
    const el = await fixture<OuIconButton>(
      '<ou-icon-button icon="copy" label="Copy address"></ou-icon-button>',
    );
    expect($(el, 'button').getAttribute('aria-label')).toBe('Copy address');
    await expectAccessible(el);
  });

  it('axe catches a missing label (proves shadow DOM is audited)', async () => {
    const el = await fixture<OuIconButton>('<ou-icon-button icon="copy"></ou-icon-button>');
    $(el, 'button').removeAttribute('title');
    const res = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toContain('button-name');
  });

  it('suppresses clicks when disabled and exposes pressed state', async () => {
    const el = await fixture<OuIconButton>(
      '<ou-icon-button icon="visible" label="Show" disabled></ou-icon-button>',
    );
    const spy = vi.fn();
    el.addEventListener('click', spy);
    $(el, 'button').click();
    expect(spy).not.toHaveBeenCalled();
    el.pressed = true;
    await el.updateComplete;
    expect($(el, 'button').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('ou-input', () => {
  it('associates label, help and error', async () => {
    const el = await fixture<OuInput>(
      '<ou-input label="Label" help-text="Shown on receipts"></ou-input>',
    );
    const input = $<HTMLInputElement>(el, 'input');
    expect($(el, 'label').getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toContain($(el, '.help').id);
    el.error = 'Too long';
    await el.updateComplete;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.invalid).toBe(true);
    expect($(el, '.error').textContent).toContain('Too long');
    await expectAccessible(el);
  });

  it('emits ou-input and ou-change', async () => {
    const el = await fixture<OuInput>('<ou-input label="Name"></ou-input>');
    const onInput = vi.fn();
    const onChange = vi.fn();
    el.addEventListener('ou-input', onInput);
    el.addEventListener('ou-change', onChange);
    const input = $<HTMLInputElement>(el, 'input');
    input.value = 'Alice';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(el.value).toBe('Alice');
    expect(onInput.mock.calls[0]![0].detail).toEqual({ value: 'Alice' });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('ou-select', () => {
  it('reads light-DOM options and emits changes', async () => {
    const el = await fixture<OuSelect>(
      '<ou-select label="Currency"><option value="usd">USD</option><option value="eur" selected>EUR</option></ou-select>',
    );
    expect(el.value).toBe('eur');
    const select = $<HTMLSelectElement>(el, 'select');
    expect(select.options.length).toBe(2);
    const spy = vi.fn();
    el.addEventListener('ou-change', spy);
    select.value = 'usd';
    select.dispatchEvent(new Event('change'));
    expect(el.value).toBe('usd');
    expect(spy.mock.calls[0]![0].detail).toEqual({ value: 'usd' });
    await expectAccessible(el);
  });
});

describe('ou-dialog', () => {
  it('opens and closes with events, labelled by its title', async () => {
    const el = await fixture<OuDialog>(
      '<ou-dialog label="Pay with bitcoin"><p>Body</p></ou-dialog>',
    );
    const opened = vi.fn();
    const closed = vi.fn();
    el.addEventListener('ou-open', opened);
    el.addEventListener('ou-close', closed);
    el.show();
    await el.updateComplete;
    const dlg = $<HTMLDialogElement>(el, 'dialog');
    expect(dlg.hasAttribute('open')).toBe(true);
    expect(opened).toHaveBeenCalledOnce();
    expect(dlg.getAttribute('aria-labelledby')).toBe($(el, 'h2').id);
    await expectAccessible(el);
    ($(el, '.close') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(closed.mock.calls[0]![0].detail).toEqual({ reason: 'close-button' });
  });

  it('routes Escape through a cancelable ou-request-close', async () => {
    const el = await fixture<OuDialog>('<ou-dialog label="Confirm" open></ou-dialog>');
    el.addEventListener('ou-request-close', (e) => e.preventDefault(), { once: true });
    $(el, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await el.updateComplete;
    expect(el.open).toBe(true);
    $(el, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await el.updateComplete;
    expect(el.open).toBe(false);
  });

  it('shows the footer only when slotted', async () => {
    const el = await fixture<OuDialog>(
      '<ou-dialog label="x" open><ou-button slot="footer">OK</ou-button></ou-dialog>',
    );
    await settle(el);
    expect($(el, 'footer').className).not.toContain('empty');
  });
});

describe('ou-tooltip', () => {
  it('describes the trigger and toggles on focus/escape', async () => {
    const el = await fixture<OuTooltip>(
      '<ou-tooltip content="Network fee paid to miners"><button>Fee</button></ou-tooltip>',
    );
    const trigger = el.querySelector('button')!;
    const descId = trigger.getAttribute('aria-describedby')!;
    expect(document.getElementById(descId)?.textContent).toBe('Network fee paid to miners');
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(el.hasAttribute('data-open')).toBe(true);
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.hasAttribute('data-open')).toBe(false);
    await expectAccessible(el);
  });
});

describe('toast()', () => {
  it('creates a live region and auto-dismisses (pausing on hover)', async () => {
    vi.useFakeTimers();
    try {
      const t = toast('Payment received', { variant: 'success', duration: 1000 }) as OuToast;
      await t.updateComplete;
      expect(document.querySelector('ou-toaster')).not.toBeNull();
      expect(t.getAttribute('role')).toBe('status');
      t.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(5000);
      expect(t.isConnected).toBe(true);
      t.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(1100);
      expect(t.isConnected).toBe(false);
      const err = toast('Payment failed', { variant: 'danger', duration: 0 })!;
      expect(err.getAttribute('role')).toBe('alert');
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be dismissed with its button', async () => {
    const t = toast('Hello', { duration: 0 })!;
    await t.updateComplete;
    const spy = vi.fn();
    t.addEventListener('ou-close', spy);
    ($(t, 'button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
    expect(t.isConnected).toBe(false);
  });
});

describe('ou-tabs', () => {
  const markup = `<ou-tabs label="Payment method">
    <div slot="lightning" label="Lightning">LN</div>
    <div slot="onchain" label="On-chain">BTC</div>
    <div slot="disabled" label="Liquid" disabled>L</div>
  </ou-tabs>`;

  it('implements the ARIA tabs pattern', async () => {
    const el = await fixture<OuTabs>(markup);
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role=tab]');
    expect(tabs).toHaveLength(3);
    expect(el.value).toBe('lightning');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.tabIndex).toBe(-1);
    const panels = el.shadowRoot!.querySelectorAll('[role=tabpanel]');
    expect(panels[1]!.hasAttribute('hidden')).toBe(true);
    await expectAccessible(el);
  });

  it('supports arrow/home/end keys and skips disabled tabs', async () => {
    const el = await fixture<OuTabs>(markup);
    const spy = vi.fn();
    el.addEventListener('ou-change', spy);
    const list = $(el, '[role=tablist]');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('onchain');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('lightning');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('onchain');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('onchain');
    expect(spy).toHaveBeenCalled();
  });
});

describe('ou-copy-button', () => {
  it('copies, confirms and announces', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await fixture<OuCopyButton>('<ou-copy-button value="bc1qtest"></ou-copy-button>');
    const spy = vi.fn();
    el.addEventListener('ou-copy', spy);
    expect(await el.copy()).toBe(true);
    await el.updateComplete;
    expect(writeText).toHaveBeenCalledWith('bc1qtest');
    expect(spy.mock.calls[0]![0].detail).toEqual({ value: 'bc1qtest' });
    expect($(el, 'button').getAttribute('aria-label')).toBe('Copied');
    expect($(el, '[role=status]').textContent).toBe('Copied to clipboard');
    await expectAccessible(el);
  });

  it('reports failures', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
      configurable: true,
    });
    const el = await fixture<OuCopyButton>(
      '<ou-copy-button value="x" appearance="button"></ou-copy-button>',
    );
    const spy = vi.fn();
    el.addEventListener('ou-copy-error', spy);
    expect(await el.copy()).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('ou-qr-code', () => {
  it('builds run-length paths', () => {
    expect(qrPath([[true, true, false, true]])).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });

  it('renders an accessible SVG QR code', async () => {
    const el = await fixture<OuQrCode>(
      '<ou-qr-code value="BITCOIN:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4" label="payment request"></ou-qr-code>',
    );
    const box = $(el, '[role=img]');
    expect(box.getAttribute('aria-label')).toBe('QR code for payment request');
    expect($(el, 'path').getAttribute('d')!.length).toBeGreaterThan(100);
    await expectAccessible(el);
  });

  it('shows empty and error states', async () => {
    const el = await fixture<OuQrCode>('<ou-qr-code></ou-qr-code>');
    expect($(el, '.empty')).not.toBeNull();
    el.value = 'x'.repeat(5000);
    await el.updateComplete;
    expect($(el, '.empty').textContent).toContain('Too much data');
  });
});

describe('ou-dialog focus restore', () => {
  it('returns focus to the deepest focused element inside shadow roots', async () => {
    const host = await fixture<HTMLElement>(
      '<div><ou-button id="opener">Open</ou-button><ou-dialog label="x"></ou-dialog></div>',
    );
    const btn = host.querySelector('ou-button')!;
    await (btn as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const inner = btn.shadowRoot!.querySelector('button')!;
    inner.focus();
    const dlg = host.querySelector('ou-dialog')!;
    dlg.show();
    await dlg.updateComplete;
    const spy = vi.spyOn(inner, 'focus');
    dlg.hide();
    await dlg.updateComplete;
    expect(spy).toHaveBeenCalled();
  });
});
