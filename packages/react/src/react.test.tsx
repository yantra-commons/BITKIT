import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@bitkit-ui/adapters';
import type { BkAmountDisplay, BkCheckout } from '@bitkit-ui/elements';
import { AmountDisplay, Checkout, PayButton } from './index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, root };
}

describe('@bitkit-ui/react', () => {
  it('passes bigint props through as properties', async () => {
    const { host } = mount(<AmountDisplay amount={21000n} unit="btc" />);
    const el = host.querySelector('bk-amount-display') as BkAmountDisplay;
    await el.updateComplete;
    expect(el.amount).toBe(21000n);
    expect(el.shadowRoot!.textContent!.split(/[\s]+/).join(' ')).toContain('0.00021 BTC');
  });

  it('maps custom events to on* props and passes adapter objects', async () => {
    const adapter = new MockAdapter({ scenario: 'lightning', stepMs: 20, latencyMs: 0 });
    const onPaid = vi.fn();
    const onInvoiceCreated = vi.fn();
    const { host } = mount(
      <Checkout
        adapter={adapter}
        amount={1000n}
        onPaid={onPaid}
        onInvoiceCreated={onInvoiceCreated}
      />,
    );
    const el = host.querySelector('bk-checkout') as BkCheckout;
    expect(el.adapter).toBe(adapter);
    await vi.waitFor(() => expect(onPaid).toHaveBeenCalled(), { timeout: 2000 });
    expect(onInvoiceCreated.mock.calls[0]![0].detail.invoice.amountSats).toBe(1000n);
    adapter.dispose();
  });

  it('renders children into the default slot', () => {
    const { host } = mount(<PayButton amount={5000n}>Buy coffee</PayButton>);
    expect(host.querySelector('bk-pay-button')!.textContent).toBe('Buy coffee');
  });
});
