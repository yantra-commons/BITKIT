/**
 * Live adapter tests: real providers, real Lightning and on-chain payments, on a local regtest
 * network (coins have no value). Start the stack first: `pnpm integration:up`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NWCClient } from '@getalby/sdk/nwc';
import {
  BtcPayAdapter,
  LnbitsAdapter,
  NwcAdapter,
  OpenNodeAdapter,
  type Invoice,
  type PaymentAdapter,
  type PaymentStatus,
  type PaymentUpdate,
} from '@orange-ui/adapters';
import { decodeBolt11 } from '@orange-ui/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { btc, here, mine, payInvoice, sleep } from './lib.mjs';

const envFile = join(here, '.env.integration');
if (!existsSync(envFile)) throw new Error('Run `pnpm integration:up` first.');
const env: Record<string, string> = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

/** Collect subscribe() updates until one matches `until` (or time out). */
function watch(adapter: PaymentAdapter, id: string, until: PaymentStatus[], timeoutMs = 60_000) {
  const seen: PaymentUpdate[] = [];
  return new Promise<PaymentUpdate[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(
        new Error(`no ${until.join('/')} after ${timeoutMs} ms; saw ${seen.map((u) => u.status)}`),
      );
    }, timeoutMs);
    const stop = adapter.subscribe(
      id,
      (u) => {
        seen.push(u);
        if (until.includes(u.status)) {
          clearTimeout(timer);
          stop();
          resolve(seen);
        }
      },
      { intervalMs: 500 },
    );
  });
}

/** Checks every Lightning invoice must pass, whatever the provider. */
function expectLightningInvoice(inv: Invoice, sats: bigint) {
  expect(inv.status).toBe('pending');
  expect(inv.amountSats).toBe(sats);
  expect(inv.network).toBe('regtest');
  expect(inv.lightning).toMatch(/^lnbcrt/);
  const decoded = decodeBolt11(inv.lightning!);
  expect(decoded.amountMsat).toBe(sats * 1000n);
  expect(inv.expiresAt).toBeGreaterThan(Date.now());
  expect(Math.abs(inv.createdAt - Date.now())).toBeLessThan(120_000);
  return decoded;
}

const sendOnchain = (address: string, sats: bigint) =>
  btc('sendtoaddress', address, (Number(sats) / 1e8).toFixed(8));

describe('LNbits (LND backend)', () => {
  const adapter = new LnbitsAdapter({ baseUrl: env.LNBITS_URL!, apiKey: env.LNBITS_INVOICE_KEY });

  it('paid: invoice is paid over Lightning and reported with the preimage', async () => {
    const inv = await adapter.createInvoice({ amountSats: 2100n, description: 'LNbits paid' });
    const decoded = expectLightningInvoice(inv, 2100n);
    expect(inv.id).toBe(decoded.paymentHash);
    expect(decoded.description).toBe('LNbits paid');

    const updates = watch(adapter, inv.id, ['paid']);
    const paid = payInvoice(inv.lightning!);
    const seen = await updates;
    expect(seen.at(-1)).toMatchObject({ status: 'paid', method: 'lightning' });
    expect(seen.at(-1)!.preimage).toBe(paid.payment_preimage);
    expect((await adapter.getStatus(inv.id)).status).toBe('paid');
  });

  it('expired: an unpaid invoice expires and can no longer be paid', async () => {
    const inv = await adapter.createInvoice({ amountSats: 1000n, expirySeconds: 5 });
    expectLightningInvoice(inv, 1000n);
    expect(inv.expiresAt! - inv.createdAt).toBe(5000);
    expect((await adapter.getStatus(inv.id)).status).toBe('pending');
    const seen = await watch(adapter, inv.id, ['expired', 'paid'], 30_000);
    expect(seen.at(-1)!.status).toBe('expired');
    expect(() => payInvoice(inv.lightning!)).toThrow();
  });

  it('a fresh adapter instance (e.g. after a server restart) still reports expiry', async () => {
    const inv = await adapter.createInvoice({ amountSats: 1000n, expirySeconds: 3 });
    await sleep(5000);
    const fresh = new LnbitsAdapter({ baseUrl: env.LNBITS_URL!, apiKey: env.LNBITS_INVOICE_KEY });
    expect((await fresh.getStatus(inv.id)).status).toBe('expired');
  });

  it('rejects a bad key with an AdapterError carrying the HTTP status', async () => {
    const bad = new LnbitsAdapter({ baseUrl: env.LNBITS_URL!, apiKey: 'not-a-key' });
    // LNbits answers an unknown key with 404 "Wallet not found", not 401.
    await expect(bad.createInvoice({ amountSats: 1000n })).rejects.toMatchObject({
      name: 'AdapterError',
      status: 404,
    });
  });
});

describe('BTCPay Server (Greenfield API, internal LND + NBXplorer)', () => {
  const adapter = new BtcPayAdapter({
    baseUrl: env.BTCPAY_URL!,
    storeId: env.BTCPAY_STORE_ID!,
    apiKey: env.BTCPAY_API_KEY,
    network: 'regtest',
  });

  it('creates an invoice offering both Lightning and on-chain', async () => {
    const inv = await adapter.createInvoice({
      amountSats: 5000n,
      description: 'BTCPay both',
      orderId: 'order-1',
    });
    expectLightningInvoice(inv, 5000n);
    expect(inv.onchain?.address).toMatch(/^bcrt1/);
    expect(inv.onchain?.uri).toMatch(/^bitcoin:bcrt1.*amount=0\.00005/i);
    expect(inv.checkoutUrl).toContain(inv.id);
    expect(inv.description).toBe('BTCPay both');
  });

  it('paid over Lightning', async () => {
    const inv = await adapter.createInvoice({ amountSats: 5000n, methods: ['lightning'] });
    expectLightningInvoice(inv, 5000n);
    expect(inv.onchain).toBeUndefined();
    const updates = watch(adapter, inv.id, ['paid', 'overpaid']);
    payInvoice(inv.lightning!);
    const last = (await updates).at(-1)!;
    expect(last).toMatchObject({ status: 'paid', method: 'lightning', amountReceivedSats: 5000n });
  });

  it('paid on-chain: confirming while unconfirmed, paid after a block', async () => {
    const inv = await adapter.createInvoice({ amountSats: 20_000n, methods: ['onchain'] });
    expect(inv.lightning).toBeUndefined();
    const updates = watch(adapter, inv.id, ['paid', 'overpaid'], 120_000);
    const txid = sendOnchain(inv.onchain!.address, 20_000n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    // Give BTCPay time to see the mempool transaction before confirming it.
    await sleep(8000);
    mine(1);
    const seen = await updates;
    expect(seen.map((u) => u.status)).toContain('confirming');
    expect(seen.at(-1)).toMatchObject({
      status: 'paid',
      method: 'onchain',
      amountReceivedSats: 20_000n,
    });
  });

  it('underpaid on-chain is reported as underpaid, not paid', async () => {
    const inv = await adapter.createInvoice({ amountSats: 30_000n, methods: ['onchain'] });
    const updates = watch(adapter, inv.id, ['underpaid', 'paid', 'overpaid']);
    sendOnchain(inv.onchain!.address, 10_000n);
    mine(1);
    const last = (await updates).at(-1)!;
    expect(last.status).toBe('underpaid');
    expect(last.amountReceivedSats).toBe(10_000n);
  });

  it('overpaid on-chain is reported as overpaid', async () => {
    const inv = await adapter.createInvoice({ amountSats: 10_000n, methods: ['onchain'] });
    const updates = watch(adapter, inv.id, ['paid', 'overpaid'], 120_000);
    sendOnchain(inv.onchain!.address, 15_000n);
    await sleep(5000);
    mine(1);
    const last = (await updates).at(-1)!;
    expect(last.status).toBe('overpaid');
    expect(last.amountReceivedSats).toBe(15_000n);
  });

  it('expired: an unpaid invoice expires (BTCPay minimum is 1 minute)', async () => {
    const inv = await adapter.createInvoice({ amountSats: 1000n, expirySeconds: 60 });
    expect(inv.expiresAt! - inv.createdAt).toBe(60_000);
    const seen = await watch(adapter, inv.id, ['expired', 'paid'], 150_000);
    expect(seen.at(-1)!.status).toBe('expired');
  });

  it('cancel() needs canmanageinvoicestatus, as documented', async () => {
    const inv = await adapter.createInvoice({ amountSats: 1000n });
    // The minimal key the docs recommend can't cancel, and says why.
    await expect(adapter.cancel(inv.id)).rejects.toMatchObject({
      name: 'AdapterError',
      status: 403,
      message: expect.stringContaining('canmanageinvoicestatus'),
    });
    const withCancel = new BtcPayAdapter({
      baseUrl: env.BTCPAY_URL!,
      storeId: env.BTCPAY_STORE_ID!,
      apiKey: env.BTCPAY_CANCEL_KEY,
      network: 'regtest',
    });
    await withCancel.cancel(inv.id);
    expect((await adapter.getStatus(inv.id)).status).toBe('failed');
  });
});

describe('Nostr Wallet Connect (Alby Hub on LND, receive-only connection)', () => {
  let client: NWCClient;
  let adapter: NwcAdapter;
  beforeAll(() => {
    client = new NWCClient({ nostrWalletConnectUrl: env.NWC_URL! });
    adapter = new NwcAdapter({ client });
  });
  afterAll(() => client?.close());

  it('paid: invoice made over NWC is paid and reported with the preimage', async () => {
    const inv = await adapter.createInvoice({ amountSats: 3000n, description: 'NWC paid' });
    const decoded = expectLightningInvoice(inv, 3000n);
    expect(inv.id).toBe(decoded.paymentHash);
    const updates = watch(adapter, inv.id, ['paid']);
    const paid = payInvoice(inv.lightning!);
    const last = (await updates).at(-1)!;
    expect(last).toMatchObject({ status: 'paid', method: 'lightning' });
    expect(last.preimage).toBe(paid.payment_preimage);
  });

  it('expired: an unpaid invoice expires', async () => {
    const inv = await adapter.createInvoice({ amountSats: 1000n, expirySeconds: 5 });
    expectLightningInvoice(inv, 1000n);
    const seen = await watch(adapter, inv.id, ['expired', 'paid'], 30_000);
    expect(seen.at(-1)!.status).toBe('expired');
  });

  it('the receive-only connection cannot spend', async () => {
    const other = await new LnbitsAdapter({
      baseUrl: env.LNBITS_URL!,
      apiKey: env.LNBITS_INVOICE_KEY,
    }).createInvoice({ amountSats: 10n });
    await expect(client.payInvoice({ invoice: other.lightning! })).rejects.toThrow();
  });
});

// OpenNode has no self-hosted version. Set OPENNODE_API_KEY (an invoice key from
// https://app.dev.opennode.com, which runs on testnet) to check the live API shape.
describe.skipIf(!process.env.OPENNODE_API_KEY)('OpenNode (dev API, testnet)', () => {
  const adapter = new OpenNodeAdapter({
    baseUrl: 'https://dev-api.opennode.com',
    apiKey: process.env.OPENNODE_API_KEY,
    network: 'testnet',
  });

  it('creates a charge with Lightning and on-chain details and reads its status', async () => {
    const inv = await adapter.createInvoice({ amountSats: 2000n, description: 'Orange UI test' });
    expect(inv.status).toBe('pending');
    expect(inv.amountSats).toBe(2000n);
    expect(inv.lightning).toMatch(/^lntb/);
    expect(decodeBolt11(inv.lightning!).amountMsat).toBe(2_000_000n);
    expect(inv.onchain?.address).toMatch(/^(tb1|[mn2])/);
    expect(inv.expiresAt).toBeGreaterThan(Date.now());
    expect((await adapter.getStatus(inv.id)).status).toBe('pending');
  });
});
