import { createApp, h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@bitkit-ui/adapters';
import type { BkAmountDisplay, BkCheckout } from '@bitkit-ui/elements';
import { AmountDisplay, Checkout, isCustomElement, PayButton } from './index.js';

function mount(render: () => ReturnType<typeof h>) {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render });
  app.config.compilerOptions.isCustomElement = isCustomElement;
  app.mount(host);
  return host;
}

describe('@bitkit-ui/vue', () => {
  it('sets props as DOM properties (bigint safe)', async () => {
    const host = mount(() => h(AmountDisplay, { amount: 21000n, unit: 'btc' }));
    await nextTick();
    const el = host.querySelector('bk-amount-display') as BkAmountDisplay;
    await el.updateComplete;
    expect(el.amount).toBe(21000n);
    expect(el.shadowRoot!.textContent!.split(/[\s]+/).join(' ')).toContain('0.00021 BTC');
  });

  it('re-emits custom events with Vue names', async () => {
    const adapter = new MockAdapter({ scenario: 'lightning', stepMs: 20, latencyMs: 0 });
    const onPaid = vi.fn();
    const onStatus = vi.fn();
    const host = mount(() =>
      h(Checkout, { adapter, amount: 1000n, onPaid, onStatusChange: onStatus }),
    );
    await nextTick();
    const el = host.querySelector('bk-checkout') as BkCheckout;
    expect(el.adapter).toBe(adapter);
    await vi.waitFor(() => expect(onPaid).toHaveBeenCalled(), { timeout: 2000 });
    expect(onStatus).toHaveBeenCalled();
    adapter.dispose();
  });

  it('passes slots and attrs', async () => {
    const host = mount(() => h(PayButton, { amount: 5000n, id: 'pay' }, () => 'Buy coffee'));
    await nextTick();
    const el = host.querySelector('bk-pay-button')!;
    expect(el.id).toBe('pay');
    expect(el.textContent).toBe('Buy coffee');
    expect(isCustomElement('bk-checkout')).toBe(true);
    expect(isCustomElement('div')).toBe(false);
  });
});
