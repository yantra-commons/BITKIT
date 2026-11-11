// Applies property-only setup to live demos (mirrors the `js` snippets in src/lib/examples.ts).
import { encodeUnsignedBolt11 } from '@bitkit-ui/core';
import { configure, toast } from '@bitkit-ui/elements';
import type { MockScenario } from '@bitkit-ui/adapters/mock';
import { demoAdapter } from './kit.js';

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const now = Date.now();

const setups: Record<string, (root: HTMLElement) => void> = {
  dialog(root) {
    root
      .querySelector('#open-dialog')
      ?.addEventListener('click', () =>
        (root.querySelector('#demo-dialog') as HTMLElement & { show(): void }).show(),
      );
  },
  toast(root) {
    root
      .querySelector('#toast-btn')
      ?.addEventListener('click', () =>
        toast('Payment received: 21,000 sats', { variant: 'success' }),
      );
  },
  'invoice-display'(root) {
    const el = root.querySelector('#invoice-demo') as HTMLElement & { invoice: string };
    el.invoice = encodeUnsignedBolt11({
      network: 'mainnet',
      amountMsat: 250_000_000n,
      timestamp: Math.floor(Date.now() / 1000),
      paymentHash: crypto.getRandomValues(new Uint8Array(32)),
      paymentSecret: crypto.getRandomValues(new Uint8Array(32)),
      description: '1 cup coffee',
      expiry: 900,
    });
  },
  'transaction-list'(root) {
    Object.assign(root.querySelector('#tx-list')!, {
      transactions: [
        {
          id: 'a',
          direction: 'incoming',
          amount: 21000,
          timestamp: now - 300000,
          method: 'lightning',
          label: 'Coffee refund',
        },
        {
          id: 'b',
          direction: 'outgoing',
          amount: 50000,
          fee: 420,
          timestamp: now - 7200000,
          status: 'pending',
          confirmations: 1,
        },
        {
          id: 'c',
          direction: 'incoming',
          amount: 1250000,
          timestamp: now - 86400000 * 1.5,
          label: 'Salary',
        },
      ],
    });
  },
  'fee-selector'(root) {
    Object.assign(root.querySelector('#fees')!, {
      fees: { fastestFee: 24, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 },
    });
  },
  'utxo-list'(root) {
    Object.assign(root.querySelector('#utxos')!, {
      utxos: [
        {
          txid: 'aa'.repeat(32),
          vout: 0,
          value: 50000,
          confirmations: 120,
          label: 'Exchange withdrawal',
        },
        { txid: 'bb'.repeat(32), vout: 1, value: 20000, confirmations: 3 },
        {
          txid: 'cc'.repeat(32),
          vout: 0,
          value: 546,
          confirmations: 40,
          label: 'Dust',
          frozen: true,
        },
      ],
    });
  },
  'mnemonic-display'(root) {
    Object.assign(root.querySelector('#phrase')!, { words: PHRASE.split(' ') });
  },
  'backup-check'(root) {
    Object.assign(root.querySelector('#check')!, { words: PHRASE.split(' ') });
  },
};

for (const demo of document.querySelectorAll<HTMLElement>('[data-demo]')) {
  const preview = demo.querySelector<HTMLElement>('.bk-demo__preview')!;
  setups[demo.dataset.demo!]?.(preview);
  demo.querySelector<HTMLSelectElement>('[data-control=theme]')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v === 'auto') preview.removeAttribute('data-bk-theme');
    else preview.setAttribute('data-bk-theme', v);
  });
  demo
    .querySelector<HTMLSelectElement>('[data-control=network]')
    ?.addEventListener('change', (e) => {
      configure({ network: (e.target as HTMLSelectElement).value as never });
    });
  demo
    .querySelector<HTMLSelectElement>('[data-control=scenario]')
    ?.addEventListener('change', (e) => {
      demoAdapter.scenario = (e.target as HTMLSelectElement).value as MockScenario;
      preview
        .querySelectorAll<HTMLElement & { start?: () => void }>('bk-checkout')
        .forEach((c) => c.start?.());
    });
}
