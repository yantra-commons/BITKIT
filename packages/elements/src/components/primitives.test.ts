import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture, settle } from '../../test/helpers.js';
import '../index.js';
import { qrPath } from './qr-code/qr-code.js';
import { toast } from './toast/toast.js';
import type {
  BkBadge,
  BkCopyButton,
  BkDialog,
  BkIcon,
  BkIconButton,
  BkInput,
  BkQrCode,
  BkSelect,
  BkSkeleton,
  BkSpinner,
  BkTabs,
  BkToast,
  BkTooltip,
} from '../index.js';

describe('bk-icon', () => {
  it('is decorative by default and labelled when asked', async () => {
    const el = await fixture<BkIcon>('<bk-icon name="lightning"></bk-icon>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect($(el, 'svg')).not.toBeNull();
    el.label = 'Lightning';
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Lightning');
    await expectAccessible(el);
  });
});

describe('bk-spinner / bk-skeleton / bk-badge', () => {
  it('spinner announces a label', async () => {
    const el = await fixture<BkSpinner>('<bk-spinner label="Checking payment"></bk-spinner>');
    expect($(el, '[role=status]').textContent).toContain('Checking payment');
    await expectAccessible(el);
  });

  it('skeleton is hidden from assistive tech and sizes itself', async () => {
    const el = await fixture<BkSkeleton>('<bk-skeleton shape="circle" width="40px"></bk-skeleton>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect($(el, '.s').getAttribute('style')).toMatch(/height:s?40px/);
  });

  it('badge renders its variant', async () => {
    const el = await fixture<BkBadge>('<bk-badge variant="success">Paid</bk-badge>');
    expect($(el, '.b').className).toContain('success');
    await expectAccessible(el);
  });
});

describe('bk-icon-button', () => {
  it('uses its label as accessible name', async () => {
    const el = await fixture<BkIconButton>(
      '<bk-icon-button icon="copy" label="Copy address"></bk-icon-button>',
    );
    expect($(el, 'button').getAttribute('aria-label')).toBe('Copy address');
    await expectAccessible(el);
  });

  it('axe catches a missing label (proves shadow DOM is audited)', async () => {
    const el = await fixture<BkIconButton>('<bk-icon-button icon="copy"></bk-icon-button>');
    $(el, 'button').removeAttribute('title');
    const res = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toContain('button-name');
  });

  it('suppresses clicks when disabled and exposes pressed state', async () => {
    const el = await fixture<BkIconButton>(
      '<bk-icon-button icon="visible" label="Show" disabled></bk-icon-button>',
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

describe('bk-input', () => {
  it('associates label, help and error', async () => {
    const el = await fixture<BkInput>(
      '<bk-input label="Label" help-text="Shown on receipts"></bk-input>',
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

  it('emits bk-input and bk-change', async () => {
    const el = await fixture<BkInput>('<bk-input label="Name"></bk-input>');
    const onInput = vi.fn();
    const onChange = vi.fn();
    el.addEventListener('bk-input', onInput);
    el.addEventListener('bk-change', onChange);
    const input = $<HTMLInputElement>(el, 'input');
    input.value = 'Alice';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(el.value).toBe('Alice');
    expect(onInput.mock.calls[0]![0].detail).toEqual({ value: 'Alice' });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('bk-select', () => {
  it('reads light-DOM options and emits changes', async () => {
    const el = await fixture<BkSelect>(
      '<bk-select label="Currency"><option value="usd">USD</option><option value="eur" selected>EUR</option></bk-select>',
    );
    expect(el.value).toBe('eur');
    const select = $<HTMLSelectElement>(el, 'select');
    expect(select.options.length).toBe(2);
    const spy = vi.fn();
    el.addEventListener('bk-change', spy);
    select.value = 'usd';
    select.dispatchEvent(new Event('change'));
    expect(el.value).toBe('usd');
    expect(spy.mock.calls[0]![0].detail).toEqual({ value: 'usd' });
    await expectAccessible(el);
  });
});

describe('bk-dialog', () => {
  it('opens and closes with events, labelled by its title', async () => {
    const el = await fixture<BkDialog>(
      '<bk-dialog label="Pay with bitcoin"><p>Body</p></bk-dialog>',
    );
    const opened = vi.fn();
    const closed = vi.fn();
    el.addEventListener('bk-open', opened);
    el.addEventListener('bk-close', closed);
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

  it('routes Escape through a cancelable bk-request-close', async () => {
    const el = await fixture<BkDialog>('<bk-dialog label="Confirm" open></bk-dialog>');
    el.addEventListener('bk-request-close', (e) => e.preventDefault(), { once: true });
    $(el, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await el.updateComplete;
    expect(el.open).toBe(true);
    $(el, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await el.updateComplete;
    expect(el.open).toBe(false);
  });

  it('shows the footer only when slotted', async () => {
    const el = await fixture<BkDialog>(
      '<bk-dialog label="x" open><bk-button slot="footer">OK</bk-button></bk-dialog>',
    );
    await settle(el);
    expect($(el, 'footer').className).not.toContain('empty');
  });
});

describe('bk-tooltip', () => {
  it('describes the trigger and toggles on focus/escape', async () => {
    const el = await fixture<BkTooltip>(
      '<bk-tooltip content="Network fee paid to miners"><button>Fee</button></bk-tooltip>',
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
      const t = toast('Payment received', { variant: 'success', duration: 1000 }) as BkToast;
      await t.updateComplete;
      expect(document.querySelector('bk-toaster')).not.toBeNull();
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
    t.addEventListener('bk-close', spy);
    ($(t, 'button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledOnce();
    expect(t.isConnected).toBe(false);
  });
});

describe('bk-tabs', () => {
  const markup = `<bk-tabs label="Payment method">
    <div slot="lightning" label="Lightning">LN</div>
    <div slot="onchain" label="On-chain">BTC</div>
    <div slot="disabled" label="Liquid" disabled>L</div>
  </bk-tabs>`;

  it('implements the ARIA tabs pattern', async () => {
    const el = await fixture<BkTabs>(markup);
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
    const el = await fixture<BkTabs>(markup);
    const spy = vi.fn();
    el.addEventListener('bk-change', spy);
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

describe('bk-copy-button', () => {
  it('copies, confirms and announces', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await fixture<BkCopyButton>('<bk-copy-button value="bc1qtest"></bk-copy-button>');
    const spy = vi.fn();
    el.addEventListener('bk-copy', spy);
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
    const el = await fixture<BkCopyButton>(
      '<bk-copy-button value="x" appearance="button"></bk-copy-button>',
    );
    const spy = vi.fn();
    el.addEventListener('bk-copy-error', spy);
    expect(await el.copy()).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('bk-qr-code', () => {
  it('builds run-length paths', () => {
    expect(qrPath([[true, true, false, true]])).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });

  it('renders an accessible SVG QR code', async () => {
    const el = await fixture<BkQrCode>(
      '<bk-qr-code value="BITCOIN:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4" label="payment request"></bk-qr-code>',
    );
    const box = $(el, '[role=img]');
    expect(box.getAttribute('aria-label')).toBe('QR code for payment request');
    expect($(el, 'path').getAttribute('d')!.length).toBeGreaterThan(100);
    await expectAccessible(el);
  });

  it('shows empty and error states', async () => {
    const el = await fixture<BkQrCode>('<bk-qr-code></bk-qr-code>');
    expect($(el, '.empty')).not.toBeNull();
    el.value = 'x'.repeat(5000);
    await el.updateComplete;
    expect($(el, '.empty').textContent).toContain('Too much data');
  });
});

describe('bk-dialog focus restore', () => {
  it('returns focus to the deepest focused element inside shadow roots', async () => {
    const host = await fixture<HTMLElement>(
      '<div><bk-button id="opener">Open</bk-button><bk-dialog label="x"></bk-dialog></div>',
    );
    const btn = host.querySelector('bk-button')!;
    await (btn as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const inner = btn.shadowRoot!.querySelector('button')!;
    inner.focus();
    const dlg = host.querySelector('bk-dialog')!;
    dlg.show();
    await dlg.updateComplete;
    const spy = vi.spyOn(inner, 'focus');
    dlg.hide();
    await dlg.updateComplete;
    expect(spy).toHaveBeenCalled();
  });
});
