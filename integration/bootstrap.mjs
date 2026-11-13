#!/usr/bin/env node
/**
 * Start the regtest stack and configure every provider, then write integration/.env.integration
 * with the (throwaway, regtest-only) keys the live tests need. Safe to run repeatedly.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrapLightning } from './bootstrap-lightning.mjs';
import { compose, here, waitFor } from './lib.mjs';

const LNBITS = 'http://127.0.0.1:5101';
const BTCPAY = 'http://127.0.0.1:5102';
const ALBY = 'http://127.0.0.1:5103';
const RELAY = 'ws://127.0.0.1:5104';
const ENV_FILE = join(here, '.env.integration');

/** Values from a previous run (BTCPay only allows password auth for the first admin key). */
const previous = existsSync(ENV_FILE)
  ? Object.fromEntries(
      readFileSync(ENV_FILE, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
  : {};

async function json(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}

async function lnbits() {
  await waitFor('LNbits', () => fetch(`${LNBITS}/api/v1/health`).then((r) => r.ok));
  const createWallet = () =>
    json(`${LNBITS}/api/v1/account`, {
      method: 'POST',
      body: JSON.stringify({ name: 'orange-ui-integration' }),
    });
  let wallet;
  try {
    wallet = await createWallet();
  } catch (e) {
    if (!/ 403 /.test(String(e.message))) throw e;
    // LNbits 1.7 on a brand-new database ignores the account-creation settings from the
    // environment until its first restart.
    compose(['restart', 'lnbits']);
    await waitFor('LNbits', () => fetch(`${LNBITS}/api/v1/health`).then((r) => r.ok));
    wallet = await createWallet();
  }
  return { LNBITS_URL: LNBITS, LNBITS_INVOICE_KEY: wallet.inkey };
}

async function btcpay() {
  await waitFor('BTCPay', () => json(`${BTCPAY}/api/v1/health`).then((h) => h?.synchronized), {
    timeoutMs: 300_000,
    intervalMs: 3000,
  });
  const email = 'admin@orange.test';
  const password = 'regtest-only-pass';
  try {
    await json(`${BTCPAY}/api/v1/users`, {
      method: 'POST',
      body: JSON.stringify({ email, password, isAdministrator: true }),
    });
  } catch (e) {
    // The first user already exists on a re-run.
    if (!/40[013]/.test(String(e.message))) throw e;
  }
  const basic = {
    Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
  };
  const reuse =
    previous.BTCPAY_ADMIN_KEY &&
    (await fetch(`${BTCPAY}/api/v1/stores`, {
      headers: { Authorization: `token ${previous.BTCPAY_ADMIN_KEY}` },
    }).then((r) => r.ok));
  const admin = reuse
    ? previous.BTCPAY_ADMIN_KEY
    : (
        await json(`${BTCPAY}/api/v1/api-keys`, {
          method: 'POST',
          headers: basic,
          body: JSON.stringify({ label: 'integration-admin', permissions: ['unrestricted'] }),
        })
      ).apiKey;
  const auth = { Authorization: `token ${admin}` };

  const stores = await json(`${BTCPAY}/api/v1/stores`, { headers: auth });
  let store = stores.find((s) => s.name === 'Orange UI test store');
  store ??= await json(`${BTCPAY}/api/v1/stores`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Orange UI test store', defaultCurrency: 'SATS' }),
  });
  const sp = `${BTCPAY}/api/v1/stores/${store.id}`;
  await json(`${sp}/payment-methods/BTC-LN`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ enabled: true, config: { connectionString: 'Internal Node' } }),
  });
  const methods = await json(`${sp}/payment-methods`, { headers: auth });
  if (!methods.some((m) => m.paymentMethodId === 'BTC-CHAIN')) {
    // Watch-only wallet: the private keys are not stored anywhere.
    await json(`${sp}/payment-methods/BTC-CHAIN/wallet/generate`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ savePrivateKeys: false, scriptPubKeyType: 'Segwit' }),
    });
  }
  // The key the app gets: exactly the permissions the docs tell users to grant.
  const appKey = (
    await json(`${BTCPAY}/api/v1/api-keys`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        label: 'orange-ui-app',
        permissions: [
          `btcpay.store.cancreateinvoice:${store.id}`,
          `btcpay.store.canviewinvoices:${store.id}`,
        ],
      }),
    })
  ).apiKey;
  // Same plus the one extra permission cancel() needs (see the adapters guide).
  const cancelKey = (
    await json(`${BTCPAY}/api/v1/api-keys`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        label: 'orange-ui-app-cancel',
        permissions: [
          `btcpay.store.cancreateinvoice:${store.id}`,
          `btcpay.store.canviewinvoices:${store.id}`,
          `btcpay.store.canmanageinvoicestatus:${store.id}`,
        ],
      }),
    })
  ).apiKey;
  return {
    BTCPAY_URL: BTCPAY,
    BTCPAY_STORE_ID: store.id,
    BTCPAY_API_KEY: appKey,
    BTCPAY_CANCEL_KEY: cancelKey,
    BTCPAY_ADMIN_KEY: admin,
  };
}

async function albyHub() {
  const unlockPassword = 'regtest-only-unlock';
  const info = await waitFor('Alby Hub', () => json(`${ALBY}/api/info`));
  if (!info.setupCompleted) {
    await json(`${ALBY}/api/setup`, { method: 'POST', body: JSON.stringify({ unlockPassword }) });
  }
  if (!info.running) {
    await json(`${ALBY}/api/start`, { method: 'POST', body: JSON.stringify({ unlockPassword }) });
  }
  await waitFor('Alby Hub running', () => json(`${ALBY}/api/info`).then((i) => i.running));
  const { token } = await json(`${ALBY}/api/unlock`, {
    method: 'POST',
    body: JSON.stringify({ unlockPassword, permission: 'full' }),
  });
  // Receive-only connection, as the docs recommend for browsers.
  const app = await json(`${ALBY}/api/apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `orange-ui-receive-${Date.now()}`,
      scopes: ['make_invoice', 'lookup_invoice'],
      budgetRenewal: 'never',
      maxAmount: 0,
      isolated: false,
    }),
  });
  // The hub advertises its in-network relay address; the tests connect from the host.
  return { NWC_URL: app.pairingUri.replace(/relay=[^&]+/, `relay=${encodeURIComponent(RELAY)}`) };
}

console.log('Starting regtest stack (docker compose)…');
compose(['up', '-d']);
await bootstrapLightning();
const env = { ...(await lnbits()), ...(await btcpay()), ...(await albyHub()) };
writeFileSync(
  ENV_FILE,
  '# Regtest-only keys written by integration/bootstrap.mjs. Not secrets of any real wallet.\n' +
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') +
    '\n',
);
console.log('Ready: LNbits, BTCPay Server and Alby Hub (NWC) are configured.');
console.log('Run: pnpm integration:test');
