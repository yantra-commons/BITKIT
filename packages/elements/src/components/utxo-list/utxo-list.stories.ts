import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './utxo-list.js';

const utxos = [
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
    value: 1500000,
    confirmations: 900,
    label: 'Cold storage change',
  },
  { txid: 'dd'.repeat(32), vout: 2, value: 546, confirmations: 40, label: 'Dust', frozen: true },
];

const meta: Meta = { title: 'Wallet/UTXO List', component: 'bk-utxo-list', tags: ['autodocs'] };
export default meta;

export const CoinControl: StoryObj = {
  render: () =>
    html`<div style="max-width:40rem">
      <bk-utxo-list target="100000" .utxos=${utxos}></bk-utxo-list>
    </div>`,
};
