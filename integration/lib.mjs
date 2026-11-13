/** Helpers for driving the local regtest stack (docker compose) from Node. */
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));

/** Run a command inside a compose service and return stdout. */
export function exec(service, args, { input } = {}) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...args], {
    cwd: here,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export function compose(args) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: here,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export const btc = (...args) =>
  exec('bitcoind', [
    'bitcoin-cli',
    '-regtest',
    '-rpcuser=orange',
    '-rpcpassword=orange',
    '-rpcwallet=miner',
    ...args,
  ]);

export const lncli = (node, ...args) =>
  JSON.parse(exec(node, ['lncli', '--network', 'regtest', ...args]) || '{}');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mine blocks to the miner wallet. */
export function mine(n = 1) {
  const addr = btc('getnewaddress');
  btc('generatetoaddress', String(n), addr);
}

/** Poll `fn` until it returns a truthy value. */
export async function waitFor(what, fn, { timeoutMs = 120_000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      lastErr = e;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${what}${lastErr ? `: ${lastErr.message}` : ''}`);
}

/** Pay a BOLT11 invoice from the payer node (a customer's wallet). */
export function payInvoice(bolt11) {
  return lncli('lnd-payer', 'payinvoice', '--force', '--json', bolt11);
}
