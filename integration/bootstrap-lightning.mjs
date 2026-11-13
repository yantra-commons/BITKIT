/** Step 1: chain + Lightning. Funds both LND nodes and opens payer -> merchant channel. */
import { btc, exec, lncli, mine, waitFor } from './lib.mjs';

export async function bootstrapLightning() {
  await waitFor('bitcoind', () =>
    exec('bitcoind', [
      'bitcoin-cli',
      '-regtest',
      '-rpcuser=orange',
      '-rpcpassword=orange',
      'getblockchaininfo',
    ]),
  );
  const wallets = JSON.parse(
    exec('bitcoind', [
      'bitcoin-cli',
      '-regtest',
      '-rpcuser=orange',
      '-rpcpassword=orange',
      'listwallets',
    ]),
  );
  if (!wallets.includes('miner')) {
    try {
      exec('bitcoind', [
        'bitcoin-cli',
        '-regtest',
        '-rpcuser=orange',
        '-rpcpassword=orange',
        'loadwallet',
        'miner',
      ]);
    } catch {
      exec('bitcoind', [
        'bitcoin-cli',
        '-regtest',
        '-rpcuser=orange',
        '-rpcpassword=orange',
        'createwallet',
        'miner',
      ]);
    }
  }
  const height = Number(btc('getblockcount'));
  if (height < 150) mine(150 - height);

  for (const node of ['lnd-merchant', 'lnd-payer']) {
    await waitFor(`${node} synced`, () => lncli(node, 'getinfo').synced_to_chain);
  }

  const channels = lncli('lnd-payer', 'listchannels').channels ?? [];
  const pending = lncli('lnd-payer', 'pendingchannels').pending_open_channels ?? [];
  if (channels.length === 0 && pending.length === 0) {
    for (const node of ['lnd-payer', 'lnd-merchant']) {
      const { address } = lncli(node, 'newaddress', 'p2wkh');
      btc('sendtoaddress', address, '5');
    }
    mine(6);
    await waitFor(
      'payer funds',
      () => Number(lncli('lnd-payer', 'walletbalance').confirmed_balance) > 0,
    );
    const merchant = lncli('lnd-merchant', 'getinfo').identity_pubkey;
    try {
      lncli('lnd-payer', 'connect', `${merchant}@lnd-merchant:9735`);
    } catch (e) {
      if (!/already connected/i.test(String(e.stderr ?? e.message))) throw e;
    }
    lncli('lnd-payer', 'openchannel', '--node_key', merchant, '--local_amt', '10000000');
  }
  mine(6);
  await waitFor(
    'active channel',
    () => {
      const ch = lncli('lnd-payer', 'listchannels', '--active_only').channels ?? [];
      if (ch.length === 0) mine(1);
      return ch.length > 0;
    },
    { intervalMs: 2000 },
  );
  await waitFor('merchant synced', () => lncli('lnd-merchant', 'getinfo').synced_to_chain);
  console.log('lightning: payer -> merchant channel active');
}
