import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeAddress, decodeBolt11, encodeUnsignedBolt11, parseBip21 } from '@bitkit-ui/core';
import { BtcPayAdapter, createBtcPayAdapter, mapBtcPayStatus } from './btcpay.js';
import { createHttpAdapter, HttpAdapter } from './http.js';
import { createLnbitsAdapter, LnbitsAdapter } from './lnbits.js';
import { createMockAdapter, MockAdapter } from './mock.js';
import { createNwcAdapter, NwcAdapter, type NwcClient } from './nwc.js';
import { createOpenNodeAdapter, mapOpenNodeStatus, OpenNodeAdapter } from './opennode.js';
import { createMempoolRates, MempoolRates, staticRates } from './rates.js';
import { AdapterError, isPaidStatus, isTerminalStatus, type PaymentUpdate } from './types.js';
import { assertNoBrowserSecret, cached, parseSats, pollStatus, requestJson } from './util.js';

type Route = (url: string, init?: RequestInit) => unknown;
/** Fake fetch: routes are matched by "METHOD path-suffix". */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const method = init?.method ?? 'GET';
    const key = Object.keys(routes).find((k) => {
      const [m, p] = k.split(' ');
      return m === method && url.endsWith(p!);
    });
    if (!key) return new Response('not found', { status: 404 });
    const body = routes[key]!(url, init);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fn, calls };
}

const INVOICE = encodeUnsignedBolt11({
  network: 'mainnet',
  amountMsat: 21_000_000n,
  timestamp: 1_700_000_000,
  paymentHash: new Uint8Array(32).fill(1),
  paymentSecret: new Uint8Array(32).fill(2),
  description: 'Coffee',
  expiry: 600,
});

describe('MockAdapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function create(adapter: MockAdapter, amountSats = 21_000n) {
    const p = adapter.createInvoice({ amountSats, description: 'Coffee' });
    await vi.advanceTimersByTimeAsync(500);
    return p;
  }

  it('creates well-formed, signet-only, unpayable invoices', async () => {
    const a = new MockAdapter({ now: () => 1_700_000_000_000 });
    const inv = await create(a);
    expect(inv).toMatchObject({
      id: 'mock_1',
      amountSats: 21_000n,
      network: 'signet',
      status: 'pending',
      mock: true,
    });
    const ln = decodeBolt11(inv.lightning!);
    expect(ln).toMatchObject({
      network: 'signet',
      amountMsat: 21_000_000n,
      description: 'Coffee',
      expiry: 900,
    });
    expect(ln.signature).toBe('0'.repeat(128));
    expect(decodeAddress(inv.onchain!.address).networks).toContain('signet');
    expect(parseBip21(inv.onchain!.uri!).amountMsat).toBe(21_000_000n);
    expect(inv.expiresAt).toBe(1_700_000_000_000 + 900_000);
  });

  it('is deterministic for the same seed', async () => {
    const a = await create(new MockAdapter({ seed: 7, now: () => 0 }));
    const b = await create(new MockAdapter({ seed: 7, now: () => 0 }));
    expect(a.lightning).toBe(b.lightning);
    expect(a.onchain!.address).toBe(b.onchain!.address);
  });

  it('converts fiat and validates amounts', async () => {
    const a = new MockAdapter({ fiatPrice: '50000', latencyMs: 0 });
    const inv = await a.createInvoice({
      fiat: { amount: '5', currency: 'USD' },
      methods: ['lightning'],
    });
    expect(inv.amountSats).toBe(10_000n);
    expect(inv.onchain).toBeUndefined();
    await expect(a.createInvoice({})).rejects.toThrow(AdapterError);
    await expect(a.getStatus('nope')).rejects.toThrow(/unknown invoice/);
  });

  it('simulates a Lightning payment', async () => {
    const a = new MockAdapter({ stepMs: 100 });
    const inv = await create(a);
    const updates: PaymentUpdate[] = [];
    const unsub = a.subscribe(inv.id, (u) => updates.push(u));
    await vi.advanceTimersByTimeAsync(250);
    expect(updates.map((u) => u.status)).toEqual(['pending', 'paid']);
    expect(updates[1]).toMatchObject({ method: 'lightning', amountReceivedSats: 21_000n });
    expect((await a.getStatus(inv.id)).status).toBe('paid');
    unsub();
  });

  it.each([
    ['onchain', ['pending', 'detected', 'confirming', 'confirming', 'paid']],
    ['underpaid', ['pending', 'underpaid', 'expired']],
    ['overpaid', ['pending', 'detected', 'overpaid']],
    ['expired', ['pending', 'expired']],
    ['failed', ['pending', 'failed']],
  ] as const)('simulates the %s path', async (scenario, expected) => {
    const a = new MockAdapter({ scenario, stepMs: 100, expirySeconds: 1 });
    const inv = await create(a);
    const statuses: string[] = [];
    a.subscribe(inv.id, (u) => statuses.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses).toEqual(expected);
  });

  it('supports manual control, cancel and dispose', async () => {
    const a = new MockAdapter({ scenario: 'manual' });
    const inv = await create(a);
    const statuses: string[] = [];
    a.subscribe(inv.id, (u) => statuses.push(u.status));
    a.simulatePayment(inv.id, 'onchain');
    a.simulate(inv.id, 'failed'); // ignored after terminal
    expect(statuses).toEqual(['pending', 'paid']);
    const inv2 = await create(a);
    await a.cancel(inv2.id);
    expect((await a.getStatus(inv2.id)).status).toBe('cancelled');
    a.dispose();
    await expect(a.getStatus(inv.id)).rejects.toThrow();
  });

  it('aborts createInvoice', async () => {
    const a = new MockAdapter();
    const ctrl = new AbortController();
    const p = a.createInvoice({ amountSats: 1n }, { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toThrow();
  });
});

describe('BtcPayAdapter', () => {
  const gfInvoice = {
    id: 'inv1',
    status: 'New',
    amount: '21000',
    currency: 'SATS',
    createdTime: 1700000000,
    expirationTime: 1700000900,
    checkoutLink: 'https://pay/i/inv1',
    metadata: { itemDesc: 'Coffee' },
  };
  const methods = [
    {
      paymentMethodId: 'BTC-CHAIN',
      destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      paymentLink: 'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.00021',
      amount: '0.00021',
      totalPaid: '0',
    },
    { paymentMethodId: 'BTC-LN', destination: INVOICE, amount: '0.00021', totalPaid: '0' },
  ];

  it('creates invoices via Greenfield and maps payment methods', async () => {
    const { fn, calls } = fakeFetch({
      'POST /stores/s1/invoices': () => gfInvoice,
      'GET /invoices/inv1/payment-methods': () => methods,
    });
    const a = new BtcPayAdapter({ baseUrl: 'https://proxy.example/', storeId: 's1', fetch: fn });
    const inv = await a.createInvoice({
      amountSats: 21000n,
      description: 'Coffee',
      orderId: 'o1',
      methods: ['lightning', 'onchain'],
      expirySeconds: 900,
    });
    expect(inv).toMatchObject({
      id: 'inv1',
      amountSats: 21000n,
      lightning: INVOICE,
      status: 'pending',
      expiresAt: 1700000900000,
      checkoutUrl: 'https://pay/i/inv1',
    });
    expect(inv.onchain!.address).toBe(methods[0]!.destination);
    const body = JSON.parse(calls[0]!.init!.body as string);
    expect(body).toMatchObject({
      amount: '21000',
      currency: 'SATS',
      metadata: { orderId: 'o1', itemDesc: 'Coffee' },
      checkout: { expirationMinutes: 15, paymentMethods: ['BTC-LN', 'BTC-CHAIN'] },
    });
    expect(calls[0]!.url).toBe('https://proxy.example/api/v1/stores/s1/invoices');
  });

  it('sends the API key when used server-side and supports fiat', async () => {
    const { fn, calls } = fakeFetch({
      'POST /invoices': () => ({ ...gfInvoice, amount: '5', currency: 'USD' }),
      'GET /payment-methods': () => methods,
    });
    const a = new BtcPayAdapter({
      baseUrl: 'https://btcpay',
      storeId: 's1',
      apiKey: 'secret',
      fetch: fn,
    });
    const inv = await a.createInvoice({ fiat: { amount: '5', currency: 'USD' } });
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('token secret');
    expect(inv.fiat).toEqual({ amount: '5', currency: 'USD' });
  });

  it('maps statuses and received amounts', async () => {
    expect(mapBtcPayStatus('New')).toBe('pending');
    expect(mapBtcPayStatus('New', 'PaidPartial')).toBe('underpaid');
    expect(mapBtcPayStatus('Processing')).toBe('confirming');
    expect(mapBtcPayStatus('Settled')).toBe('paid');
    expect(mapBtcPayStatus('Settled', 'PaidOver')).toBe('overpaid');
    expect(mapBtcPayStatus('Expired')).toBe('expired');
    expect(mapBtcPayStatus('Expired', 'PaidPartial')).toBe('underpaid');
    expect(mapBtcPayStatus('Invalid')).toBe('failed');
    const paidMethods = [{ ...methods[1]!, totalPaid: '0.00021' }];
    const { fn } = fakeFetch({
      'GET /invoices/inv1': () => ({ ...gfInvoice, status: 'Settled' }),
      'GET /payment-methods': () => paidMethods,
    });
    const a = new BtcPayAdapter({ baseUrl: 'https://b', storeId: 's1', fetch: fn });
    expect(await a.getStatus('inv1')).toMatchObject({
      status: 'paid',
      method: 'lightning',
      amountReceivedSats: 21000n,
    });
  });

  it('cancels by marking invalid', async () => {
    const { fn, calls } = fakeFetch({ 'POST /invoices/inv1/status': () => ({}) });
    await new BtcPayAdapter({ baseUrl: 'https://b', storeId: 's1', fetch: fn }).cancel('inv1');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ status: 'Invalid' });
  });
});

describe('LnbitsAdapter', () => {
  it('creates and checks Lightning invoices', async () => {
    const { fn, calls } = fakeFetch({
      'POST /api/v1/payments': () => ({ payment_hash: 'hash1', payment_request: INVOICE }),
      'GET /api/v1/payments/hash1': () => ({ paid: true, preimage: 'pre' }),
    });
    const a = new LnbitsAdapter({ baseUrl: 'https://lnbits/', fetch: fn });
    const inv = await a.createInvoice({ amountSats: 21n, description: 'Coffee', orderId: 'o' });
    expect(inv).toMatchObject({
      id: 'hash1',
      amountSats: 21000n /* decoded from the returned invoice */,
      lightning: INVOICE,
      network: 'mainnet',
    });
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({
      out: false,
      amount: 21,
      memo: 'Coffee',
      extra: { orderId: 'o' },
    });
    expect(await a.getStatus('hash1')).toMatchObject({ status: 'paid', preimage: 'pre' });
    await a.cancel();
  });

  it('handles fiat, expiry and unsupported methods', async () => {
    const { fn, calls } = fakeFetch({
      'POST /api/v1/payments': () => ({ payment_hash: 'h2', bolt11: INVOICE }),
      'GET /api/v1/payments/h2': () => ({ paid: false }),
      'GET /api/v1/payments/h3': () => ({ paid: false, details: { status: 'expired' } }),
    });
    const a = new LnbitsAdapter({ baseUrl: 'https://lnbits', fetch: fn });
    await a.createInvoice({ fiat: { amount: '2', currency: 'EUR' } });
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({ amount: '2', unit: 'EUR' });
    expect((await a.getStatus('h2')).status).toBe('expired'); // invoice timestamp is in 2023
    expect((await a.getStatus('h3')).status).toBe('expired');
    await expect(a.createInvoice({ amountSats: 1n, methods: ['onchain'] })).rejects.toThrow(
      /only Lightning/,
    );
    await expect(a.createInvoice({})).rejects.toThrow(/amount/);
  });

  it('errors when no payment request is returned', async () => {
    const { fn } = fakeFetch({ 'POST /api/v1/payments': () => ({ payment_hash: 'x' }) });
    await expect(
      new LnbitsAdapter({ baseUrl: 'https://l', fetch: fn }).createInvoice({ amountSats: 1n }),
    ).rejects.toThrow(/no payment request/);
  });
});

describe('OpenNodeAdapter', () => {
  const charge = {
    id: 'c1',
    status: 'unpaid',
    amount: 21000,
    description: 'Coffee',
    created_at: 1700000000,
    hosted_checkout_url: 'https://checkout',
    lightning_invoice: { payreq: INVOICE, expires_at: 1700000600 },
    chain_invoice: { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
  };

  it('creates charges and reads status', async () => {
    const { fn, calls } = fakeFetch({
      'POST /v1/charges': () => ({ data: charge }),
      'GET /v1/charge/c1': () => ({
        data: { ...charge, status: 'processing', missing_amt: 0, transactions: [{ tx: 'abc' }] },
      }),
    });
    const a = new OpenNodeAdapter({ fetch: fn });
    const inv = await a.createInvoice({
      amountSats: 21000n,
      description: 'Coffee',
      expirySeconds: 600,
    });
    expect(inv).toMatchObject({
      id: 'c1',
      amountSats: 21000n,
      lightning: INVOICE,
      expiresAt: 1700000600000,
      checkoutUrl: 'https://checkout',
    });
    expect(parseBip21(inv.onchain!.uri!).amountMsat).toBe(21_000_000n);
    expect(calls[0]!.url).toBe('https://api.opennode.com/v1/charges');
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({
      amount: 21000,
      currency: 'BTC',
      ttl: 10,
    });
    expect(await a.getStatus('c1')).toMatchObject({
      status: 'confirming',
      method: 'onchain',
      txid: 'abc',
      amountReceivedSats: 21000n,
    });
    await a.cancel();
  });

  it('maps statuses and respects methods', async () => {
    expect(
      ['paid', 'processing', 'underpaid', 'expired', 'refunded', 'unpaid'].map(mapOpenNodeStatus),
    ).toEqual(['paid', 'confirming', 'underpaid', 'expired', 'cancelled', 'pending']);
    const { fn } = fakeFetch({ 'POST /v1/charges': () => ({ data: charge }) });
    const inv = await new OpenNodeAdapter({ baseUrl: 'https://proxy', fetch: fn }).createInvoice({
      fiat: { amount: '1', currency: 'USD' },
      methods: ['lightning'],
    });
    expect(inv.onchain).toBeUndefined();
  });
});

describe('NwcAdapter', () => {
  const client = (state: Partial<Awaited<ReturnType<NwcClient['lookupInvoice']>>>): NwcClient => ({
    makeInvoice: vi.fn(async () => ({ invoice: INVOICE, payment_hash: 'ph' })),
    lookupInvoice: vi.fn(async () => state),
  });

  it('makes and looks up invoices through a NIP-47 client', async () => {
    const c = client({ settled_at: 1, preimage: 'pre' });
    const a = new NwcAdapter({ client: c });
    const inv = await a.createInvoice({
      amountSats: 21n,
      description: 'Coffee',
      expirySeconds: 600,
    });
    expect(c.makeInvoice).toHaveBeenCalledWith({
      amount: 21000,
      description: 'Coffee',
      expiry: 600,
    });
    expect(inv).toMatchObject({ id: 'ph', lightning: INVOICE, network: 'mainnet' });
    expect(await a.getStatus('ph')).toMatchObject({ status: 'paid', preimage: 'pre' });
    await a.cancel();
  });

  it('reports pending, expired and failed, and validates input', async () => {
    expect(
      (
        await new NwcAdapter({ client: client({ state: 'pending', expires_at: 9e12 }) }).getStatus(
          'x',
        )
      ).status,
    ).toBe('pending');
    expect(
      (await new NwcAdapter({ client: client({ expires_at: 1 }) }).getStatus('x')).status,
    ).toBe('expired');
    expect(
      (await new NwcAdapter({ client: client({ state: 'failed' }) }).getStatus('x')).status,
    ).toBe('failed');
    const a = new NwcAdapter({ client: client({}) });
    await expect(a.createInvoice({ fiat: { amount: '1', currency: 'USD' } })).rejects.toThrow(
      /amountSats/,
    );
    await expect(a.createInvoice({ amountSats: 1n, methods: ['onchain'] })).rejects.toThrow(
      /only Lightning/,
    );
    expect(() => new NwcAdapter({} as never)).toThrow(/client/);
  });
});

describe('HttpAdapter', () => {
  it('talks to a custom backend with string amounts', async () => {
    const { fn, calls } = fakeFetch({
      'POST /api/pay': () => ({ id: 'p1', amountSats: '21000', lightning: INVOICE, createdAt: 1 }),
      'GET /api/pay/p1': () => ({ status: 'detected', amountReceivedSats: '21000' }),
      'POST /api/pay/p1/cancel': () => new Response(null, { status: 204 }),
    });
    const a = new HttpAdapter({
      baseUrl: '/api/pay',
      fetch: fn,
      headers: { 'X-CSRF': 't' },
      network: 'signet',
    });
    const inv = await a.createInvoice({ amountSats: 21000n });
    expect(inv).toMatchObject({
      id: 'p1',
      amountSats: 21000n,
      network: 'signet',
      status: 'pending',
    });
    expect(JSON.parse(calls[0]!.init!.body as string).amountSats).toBe('21000');
    expect((calls[0]!.init!.headers as Record<string, string>)['X-CSRF']).toBe('t');
    expect(await a.getStatus('p1')).toMatchObject({
      invoiceId: 'p1',
      status: 'detected',
      amountReceivedSats: 21000n,
    });
    await a.cancel('p1');
  });

  it('subscribes over SSE and falls back to polling on error', async () => {
    const instances: {
      url: string;
      onmessage?: (e: { data: string }) => void;
      onerror?: () => void;
      close: () => void;
    }[] = [];
    class FakeES {
      onmessage?: (e: { data: string }) => void;
      onerror?: () => void;
      close = vi.fn();
      constructor(public url: string) {
        instances.push(this);
      }
    }
    vi.stubGlobal('EventSource', FakeES);
    try {
      const { fn } = fakeFetch({ 'GET /api/pay/p1': () => ({ status: 'paid' }) });
      const a = new HttpAdapter({ baseUrl: '/api/pay', fetch: fn, sse: true });
      const updates: PaymentUpdate[] = [];
      const unsub = a.subscribe('p1', (u) => updates.push(u));
      expect(instances[0]!.url).toBe('/api/pay/p1/events');
      instances[0]!.onmessage!({ data: JSON.stringify({ status: 'detected' }) });
      instances[0]!.onmessage!({ data: 'garbage' });
      instances[0]!.onerror!();
      await new Promise((r) => setTimeout(r, 10));
      expect(updates.map((u) => u.status)).toEqual(['detected', 'paid']);
      unsub();
      const b = new HttpAdapter({ baseUrl: '/x', fetch: fn, sse: (id) => `/custom/${id}` });
      b.subscribe('p9', () => {})();
      expect(instances[1]!.url).toBe('/custom/p9');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('rates', () => {
  it('reads and caches mempool fees and prices', async () => {
    const { fn } = fakeFetch({
      'GET /v1/fees/recommended': () => ({
        fastestFee: 10,
        halfHourFee: 5,
        hourFee: 2,
        economyFee: 1,
        minimumFee: 1,
      }),
      'GET /v1/prices': () => ({ time: 1700000000, USD: 67012.55, EUR: 0 }),
    });
    const r = new MempoolRates({ fetch: fn, baseUrl: 'https://mempool.example/api/' });
    expect((await r.getRecommendedFees()).fastestFee).toBe(10);
    await r.getRecommendedFees();
    expect(await r.getRate('usd')).toEqual({
      currency: 'USD',
      price: '67012.55',
      timestamp: 1700000000000,
    });
    await expect(r.getRate('EUR')).rejects.toThrow(/no price/);
    expect(fn).toHaveBeenCalledTimes(2); // cached
  });

  it('provides static rates', async () => {
    const r = staticRates({ USD: '60000' });
    expect((await r.getRate('usd')).price).toBe('60000');
    await expect(r.getRate('JPY')).rejects.toThrow();
    expect((await r.getRecommendedFees()).fastestFee).toBe(20);
  });
});

describe('utilities', () => {
  it('classifies statuses', () => {
    expect(isTerminalStatus('paid')).toBe(true);
    expect(isTerminalStatus('confirming')).toBe(false);
    expect(isPaidStatus('overpaid')).toBe(true);
    expect(isPaidStatus('underpaid')).toBe(false);
  });

  it('refuses secrets in the browser', () => {
    vi.stubGlobal('document', {});
    try {
      expect(() => assertNoBrowserSecret('btcpay', 'key')).toThrow(/never be shipped/);
      expect(() => assertNoBrowserSecret('btcpay', 'key', true)).not.toThrow();
      expect(() => assertNoBrowserSecret('btcpay', undefined)).not.toThrow();
      expect(() => new BtcPayAdapter({ baseUrl: 'x', storeId: 's', apiKey: 'k' })).toThrow(
        AdapterError,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports HTTP and network errors', async () => {
    const { fn } = fakeFetch({ 'GET /bad': () => new Response('nope', { status: 500 }) });
    await expect(requestJson('t', fn, 'https://x/bad')).rejects.toMatchObject({
      status: 500,
      adapter: 't',
    });
    await expect(
      requestJson(
        't',
        async () => {
          throw new TypeError('offline');
        },
        'https://x',
      ),
    ).rejects.toThrow(/network error/);
    const abort = Object.assign(new Error('a'), { name: 'AbortError' });
    await expect(
      requestJson(
        't',
        async () => {
          throw abort;
        },
        'https://x',
      ),
    ).rejects.toBe(abort);
  });

  it('parses sats', () => {
    expect(parseSats('21000')).toBe(21000n);
    expect(parseSats(21000)).toBe(21000n);
    expect(parseSats('21.9')).toBe(21n);
    expect(parseSats(5n)).toBe(5n);
    expect(parseSats(null)).toBe(0n);
  });

  it('polls until terminal, de-duplicates and backs off on errors', async () => {
    vi.useFakeTimers();
    try {
      const seq: (PaymentUpdate | Error)[] = [
        { invoiceId: 'i', status: 'pending', updatedAt: 0 },
        { invoiceId: 'i', status: 'pending', updatedAt: 1 },
        new Error('flaky'),
        { invoiceId: 'i', status: 'paid', updatedAt: 2 },
      ];
      const get = vi.fn(async () => {
        const n = seq.shift()!;
        if (n instanceof Error) throw n;
        return n;
      });
      const seen: string[] = [];
      pollStatus(get, (u) => seen.push(u.status), { intervalMs: 100 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen).toEqual(['pending', 'paid']);
      expect(get).toHaveBeenCalledTimes(4);
      const ctrl = new AbortController();
      const get2 = vi.fn(async () => ({
        invoiceId: 'i',
        status: 'pending' as const,
        updatedAt: 0,
      }));
      pollStatus(get2, () => {}, { intervalMs: 100, signal: ctrl.signal });
      ctrl.abort();
      await vi.advanceTimersByTimeAsync(500);
      expect(get2.mock.calls.length).toBeLessThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caches with TTL and evicts failures', async () => {
    let t = 0;
    let n = 0;
    const f = cached(
      async (k: string) => {
        n++;
        if (k === 'bad') throw new Error('x');
        return `${k}${n}`;
      },
      100,
      () => t,
    );
    expect(await f('a')).toBe('a1');
    expect(await f('a')).toBe('a1');
    t = 200;
    expect(await f('a')).toBe('a2');
    await expect(f('bad')).rejects.toThrow();
    await expect(f('bad')).rejects.toThrow();
    expect(n).toBe(4);
  });
});

describe('factories and polling subscriptions', () => {
  it('every adapter subscribes via polling until paid', async () => {
    const { fn } = fakeFetch({
      'GET /stores/s/invoices/i': () => ({
        id: 'i',
        status: 'Settled',
        amount: '1',
        currency: 'SATS',
      }),
      'GET /stores/s/invoices/i/payment-methods': () => [],
      'GET /api/v1/payments/i': () => ({ paid: true }),
      'GET /v1/charge/i': () => ({ data: { id: 'i', status: 'paid', amount: 1 } }),
    });
    const nwcClient: NwcClient = {
      makeInvoice: vi.fn(),
      lookupInvoice: vi.fn(async () => ({ settled_at: 1 })),
    };
    const adapters = [
      createBtcPayAdapter({ baseUrl: 'https://b', storeId: 's', fetch: fn }),
      createLnbitsAdapter({ baseUrl: 'https://l', fetch: fn }),
      createOpenNodeAdapter({ fetch: fn }),
      createNwcAdapter({ client: nwcClient }),
      createHttpAdapter({
        baseUrl: 'https://h',
        fetch: fakeFetch({ 'GET /i': () => ({ status: 'paid' }) }).fn,
      }),
    ];
    for (const a of adapters) {
      const statuses: string[] = [];
      const unsub = a.subscribe('i', (u) => statuses.push(u.status), { intervalMs: 10 });
      await new Promise((r) => setTimeout(r, 30));
      unsub();
      expect(statuses, a.name).toEqual(['paid']);
    }
    expect(createMockAdapter()).toBeInstanceOf(MockAdapter);
    expect(createMempoolRates()).toBeInstanceOf(MempoolRates);
  });
});
