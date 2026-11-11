import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeLnurl, encodeUnsignedBolt11, parseBip21 } from '@bitkit-ui/core';
import { MockAdapter, type PaymentAdapter } from '@bitkit-ui/adapters';
import { $, expectAccessible, fixture, settle } from '../../test/helpers.js';
import '../index.js';
import { registerAdapter } from '../internal/adapters.js';
import type {
  BkCheckout,
  BkDonationWidget,
  BkInvoiceDisplay,
  BkLightningAddressCard,
  BkPayButton,
  BkPaymentStatus,
} from '../index.js';

const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('timeout');
    await wait(10);
  }
}
const invoiceFor = (
  secondsAgo: number,
  amountMsat: bigint | null = 21_000_000n,
  description = 'Coffee',
) =>
  encodeUnsignedBolt11({
    network: 'mainnet',
    amountMsat,
    timestamp: Math.floor(Date.now() / 1000) - secondsAgo,
    paymentHash: new Uint8Array(32).fill(9),
    paymentSecret: new Uint8Array(32).fill(1),
    description,
    expiry: 600,
  });

const adapters: MockAdapter[] = [];
const mock = (o: ConstructorParameters<typeof MockAdapter>[0] = {}) => {
  const a = new MockAdapter({ latencyMs: 0, stepMs: 30, ...o });
  adapters.push(a);
  return a;
};
afterEach(() => adapters.splice(0).forEach((a) => a.dispose()));

describe('bk-payment-status', () => {
  it.each([
    ['pending', 'Waiting for payment'],
    ['detected', 'Payment detected'],
    ['paid', 'Payment received'],
    ['expired', 'Payment request expired'],
    ['cancelled', 'Payment cancelled'],
  ])('%s → %s', async (status, title) => {
    const el = await fixture<BkPaymentStatus>(
      `<bk-payment-status status="${status}"></bk-payment-status>`,
    );
    expect(text(el, '.title')).toBe(title);
    expect($(el, '[role=status]')).not.toBeNull();
    await expectAccessible(el);
  });

  it('explains under/overpayment amounts', async () => {
    const el = await fixture<BkPaymentStatus>(
      '<bk-payment-status status="underpaid" amount-received="5000" amount-due="21000"></bk-payment-status>',
    );
    expect(text(el, '.body')).toBe(
      'Received 5,000 sats of 21,000 sats. Send the remaining 16,000 sats to complete the payment.',
    );
    el.status = 'overpaid';
    el.amountReceived = 25000n;
    await el.updateComplete;
    expect(text(el, '.body')).toContain('You sent 4,000 sats more');
  });

  it('shows confirmation progress and alerts on failure', async () => {
    const el = await fixture<BkPaymentStatus>(
      '<bk-payment-status status="confirming" confirmations="2" required-confirmations="3"></bk-payment-status>',
    );
    const bar = $(el, '[role=progressbar]');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemax')).toBe('3');
    expect(text(el, '.body')).toBe('2 of 3 confirmations');
    await expectAccessible(el);
    el.status = 'failed';
    await el.updateComplete;
    expect($(el, '[role=alert]')).not.toBeNull();
  });
});

describe('bk-invoice-display', () => {
  it('decodes and shows amount, description and countdown', async () => {
    const el = await fixture<BkInvoiceDisplay>(
      `<bk-invoice-display qr invoice="${invoiceFor(0)}"></bk-invoice-display>`,
    );
    expect(el.decoded?.amountMsat).toBe(21_000_000n);
    expect(text(el, 'dl')).toContain('Coffee');
    expect(text(el, 'dl')).toMatch(/in (9|10):\d\d/);
    expect($(el, 'bk-qr-code')).not.toBeNull();
    await expectAccessible(el);
  });

  it('handles any-amount, expired and invalid invoices', async () => {
    const el = await fixture<BkInvoiceDisplay>(
      `<bk-invoice-display invoice="${invoiceFor(9999, null, '')}"></bk-invoice-display>`,
    );
    expect(text(el, '.any')).toBe('Any amount');
    expect(text(el, '.expired')).toBe('Expired');
    el.invoice = 'lnbc1invalid';
    await el.updateComplete;
    expect($(el, '[role=alert]').textContent).toContain('typo');
  });
});

describe('bk-checkout', () => {
  it('creates a request and shows unified QR, tabs, details and demo notice', async () => {
    const a = mock({ scenario: 'manual' });
    const created = vi.fn();
    document.addEventListener('bk-invoice-created', created, { once: true });
    const el = await fixture<BkCheckout>(
      '<bk-checkout amount="21000" description="Coffee"></bk-checkout>',
    );
    el.adapter = a;
    await el.start();
    await settle(el);
    expect(el.state).toBe('awaiting');
    expect(created).toHaveBeenCalled();
    const tabs = $(el, 'bk-tabs')!.shadowRoot!.querySelectorAll('[role=tab]');
    expect([...tabs].map((t) => t.textContent!.trim())).toEqual([
      'Any wallet',
      'Lightning',
      'On-chain',
    ]);
    const qr = el.shadowRoot!.querySelector('bk-qr-code')!;
    const uri = parseBip21(qr.value);
    expect(uri.amountMsat).toBe(21_000_000n);
    expect(uri.lightning?.toLowerCase()).toBe(el.currentInvoice!.lightning);
    expect(text(el, '.demo')).toContain('Do not send real bitcoin');
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(3);
    expect(text(el, '.meta')).toMatch(/Expires in 1[45]:\d\d/);
    await expectAccessible(el);
  });

  it('switches views between Lightning and on-chain', async () => {
    const el = await fixture<BkCheckout>('<bk-checkout amount="1000"></bk-checkout>');
    el.adapter = mock({ scenario: 'manual' });
    await el.start();
    await settle(el);
    $(el, 'bk-tabs').dispatchEvent(
      new CustomEvent('bk-change', { detail: { value: 'lightning' } }),
    );
    await settle(el);
    expect(el.shadowRoot!.querySelector('bk-qr-code')!.value).toMatch(/^LNTBS/);
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(1);
    $(el, 'bk-tabs').dispatchEvent(new CustomEvent('bk-change', { detail: { value: 'onchain' } }));
    await settle(el);
    expect(el.shadowRoot!.querySelector('bk-qr-code')!.value).toMatch(/^BITCOIN:TB1Q/);
    expect(
      $<HTMLAnchorElement>(el.shadowRoot!.querySelectorAll('bk-button')[0]!, 'a').getAttribute(
        'href',
      ),
    ).toMatch(/^bitcoin:tb1q/);
  });

  it('reaches the paid state and fires bk-paid', async () => {
    const el = await fixture<BkCheckout>('<bk-checkout amount="21000"></bk-checkout>');
    const paid = vi.fn();
    const statuses: string[] = [];
    el.addEventListener('bk-paid', paid);
    el.addEventListener('bk-status-change', (e) => statuses.push((e as CustomEvent).detail.status));
    el.adapter = mock({ scenario: 'onchain', requiredConfirmations: 2 });
    await el.start();
    await until(() => el.state === 'paid');
    await settle(el);
    expect(statuses).toEqual(['pending', 'detected', 'confirming', 'paid']);
    expect(paid.mock.calls[0]![0].detail.update.status).toBe('paid');
    expect(text($(el, 'bk-payment-status'), '.title')).toBe('Payment received');
    expect($(el, 'bk-payment-status')!.getAttribute('size')).toBe('large');
  });

  it('handles expiry with a retry', async () => {
    const el = await fixture<BkCheckout>('<bk-checkout amount="21000"></bk-checkout>');
    const a = mock({ scenario: 'expired' });
    el.adapter = a;
    const expired = vi.fn();
    el.addEventListener('bk-expired', expired);
    await el.start();
    await until(() => el.state === 'expired');
    await settle(el);
    expect(expired).toHaveBeenCalled();
    const firstId = el.currentInvoice!.id;
    a.scenario = 'manual';
    ($(el, 'bk-button') as HTMLElement).click();
    await until(() => el.state === 'awaiting');
    expect(el.currentInvoice!.id).not.toBe(firstId);
  });

  it('shows errors from the adapter and when unconfigured', async () => {
    const failing: PaymentAdapter = {
      name: 'broken',
      createInvoice: async () => {
        throw new Error('Store is offline');
      },
      getStatus: async () => ({ invoiceId: 'x', status: 'pending', updatedAt: 0 }),
      subscribe: () => () => {},
      cancel: async () => {},
    };
    const el = await fixture<BkCheckout>('<bk-checkout amount="21000"></bk-checkout>');
    await settle(el);
    expect(el.state).toBe('error');
    const onErr = vi.fn();
    el.addEventListener('bk-error', onErr);
    el.adapter = failing;
    await el.start();
    await settle(el);
    expect(el.state).toBe('error');
    expect(onErr.mock.calls[0]![0].detail.error).toBe('Store is offline');
    await expectAccessible(el);
  });

  it('resolves registered adapters by name and supports fiat amounts', async () => {
    registerAdapter('test-mock', () => mock({ scenario: 'manual', fiatPrice: '50000' }));
    const el = await fixture<BkCheckout>(
      '<bk-checkout adapter="test-mock" fiat-amount="5" fiat-currency="USD"></bk-checkout>',
    );
    await until(() => el.state === 'awaiting');
    expect(el.currentInvoice!.amountSats).toBe(10_000n);
  });

  it('accepts a pre-created invoice and expires it locally', async () => {
    const el = await fixture<BkCheckout>('<bk-checkout auto-start="false"></bk-checkout>');
    el.autoStart = false;
    el.invoice = {
      id: 'srv1',
      amountSats: 1000n,
      lightning: invoiceFor(0),
      network: 'mainnet',
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 900,
    };
    await until(() => el.state === 'awaiting');
    await settle(el);
    expect($(el, 'bk-tabs')).toBeNull();
    await until(() => el.state === 'expired', 3000);
  });

  it('never links to non-bitcoin URIs supplied by an adapter (XSS guard)', async () => {
    const el = await fixture<BkCheckout>('<bk-checkout></bk-checkout>');
    el.autoStart = false;
    el.invoice = {
      id: 'evil',
      amountSats: 1000n,
      onchain: {
        address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        uri: 'javascript:alert(1)',
      },
      network: 'mainnet',
      status: 'pending',
      createdAt: Date.now(),
    };
    await until(() => el.state === 'awaiting');
    await settle(el);
    const links = [...el.shadowRoot!.querySelectorAll('bk-button')].map(
      (b) => b.shadowRoot!.querySelector('a')?.getAttribute('href') ?? '',
    );
    expect(links.some((h) => h.startsWith('bitcoin:bc1q'))).toBe(true);
    expect(links.some((h) => /javascript:/i.test(h))).toBe(false);
  });

  it('pays with WebLN when available', async () => {
    const sendPayment = vi.fn(async () => ({ preimage: 'pre' }));
    vi.stubGlobal('webln', { enable: vi.fn(async () => {}), sendPayment });
    try {
      const el = await fixture<BkCheckout>('<bk-checkout amount="21000"></bk-checkout>');
      el.adapter = mock({ scenario: 'manual' });
      await el.start();
      await settle(el);
      const findBtn = () =>
        [...el.shadowRoot!.querySelectorAll('bk-button')].find((b) =>
          b.textContent?.split(/[\s]+/).join(' ').includes('browser wallet'),
        );
      await until(() => !!findBtn()?.shadowRoot?.querySelector('button'));
      const btn = findBtn()!;
      const paid = vi.fn();
      el.addEventListener('bk-webln-paid', paid);
      ($(btn, 'button') as HTMLButtonElement).click();
      await until(() => paid.mock.calls.length > 0);
      expect(sendPayment).toHaveBeenCalledWith(el.currentInvoice!.lightning);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('bk-pay-button', () => {
  it('opens a modal checkout and closes it', async () => {
    const el = await fixture<BkPayButton>(
      '<bk-pay-button amount="21000" description="Coffee">Buy coffee</bk-pay-button>',
    );
    el.adapter = mock({ scenario: 'manual' });
    await el.updateComplete;
    expect(el.textContent).toBe('Buy coffee');
    await expectAccessible(el);
    ($(el.shadowRoot!.querySelector('bk-button')!, 'button') as HTMLButtonElement).click();
    await settle(el);
    const checkout = el.shadowRoot!.querySelector('bk-checkout')!;
    expect(checkout.open).toBe(true);
    await until(() => checkout.state === 'awaiting');
    const dialog = checkout.shadowRoot!.querySelector('bk-dialog')!;
    expect(dialog.open).toBe(true);
    dialog.hide();
    await settle(el);
    expect(el.open).toBe(false);
  });
});

describe('bk-donation-widget', () => {
  it('selects presets with keyboard and donates with a message', async () => {
    const el = await fixture<BkDonationWidget>(
      '<bk-donation-widget presets="1000,5000" fiat-currency="USD" fiat-price="60000"></bk-donation-widget>',
    );
    el.adapter = mock({ scenario: 'manual' });
    await el.updateComplete;
    const radios = el.shadowRoot!.querySelectorAll('[role=radio]');
    expect(radios).toHaveLength(3);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(text(el, '.preset small')).toBe('≈ $0.60');
    $(el, '[role=radiogroup]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    await el.updateComplete;
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    const ta = $<HTMLTextAreaElement>(el, 'textarea');
    ta.value = 'Keep building!';
    ta.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(text(el, '.count')).toBe('14/140');
    const donate = vi.fn();
    el.addEventListener('bk-donate', donate);
    (
      $(el.shadowRoot!.querySelector('bk-button[part=submit]')!, 'button') as HTMLButtonElement
    ).click();
    await settle(el);
    expect(donate.mock.calls[0]![0].detail).toEqual({ amount: 1000n, message: 'Keep building!' });
    const checkout = el.shadowRoot!.querySelector('bk-checkout')!;
    await until(() => checkout.state === 'awaiting');
    expect(checkout.currentInvoice!.description).toBe('Keep building!');
    await expectAccessible(el);
  });

  it('supports custom amounts and enforces the minimum', async () => {
    const el = await fixture<BkDonationWidget>(
      '<bk-donation-widget min="500"></bk-donation-widget>',
    );
    ($(el, '[role=radio]:last-child') as HTMLButtonElement).click();
    await settle(el);
    const input = el.shadowRoot!.querySelector('bk-amount-input')!;
    input.dispatchEvent(new CustomEvent('bk-input', { detail: { valid: true, amount: 100n } }));
    await el.updateComplete;
    expect(
      $(el.shadowRoot!.querySelector('bk-button[part=submit]')!, 'button').getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    input.dispatchEvent(new CustomEvent('bk-input', { detail: { valid: true, amount: 777n } }));
    await settle(el);
    expect(text(el, 'bk-button[part=submit]')).toContain('Donate 777 sats');
  });
});

describe('bk-lightning-address-card', () => {
  it('renders a shareable card with an LNURL QR', async () => {
    const el = await fixture<BkLightningAddressCard>(
      '<bk-lightning-address-card address="Satoshi@Example.com" description="Tips welcome"></bk-lightning-address-card>',
    );
    expect(text(el, '.addr')).toBe('satoshi@example.com');
    expect(text(el, '.avatar')).toBe('S');
    const qr = el.shadowRoot!.querySelector('bk-qr-code')!;
    expect(decodeLnurl(qr.value).url).toBe('https://example.com/.well-known/lnurlp/satoshi');
    expect($<HTMLAnchorElement>(el, 'a.open').getAttribute('href')).toMatch(/^lightning:LNURL1/);
    await expectAccessible(el);
  });

  it('fetches metadata on request and reports invalid addresses', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            minSendable: 1000,
            maxSendable: 100000000,
            metadata: JSON.stringify([['text/plain', 'Pay Bob']]),
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = await fixture<BkLightningAddressCard>(
        '<bk-lightning-address-card address="bob@example.com" fetch-metadata></bk-lightning-address-card>',
      );
      await until(() => !!el._meta);
      await el.updateComplete;
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/.well-known/lnurlp/bob');
      expect(text(el, '.desc')).toBe('Pay Bob');
      expect(text(el, '.limits')).toBe('Send 1 sat – 100,000 sats');
      el.address = 'not an address';
      await el.updateComplete;
      expect($(el, '[role=alert]')).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
