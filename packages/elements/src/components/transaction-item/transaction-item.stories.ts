import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './transaction-item.js';

const meta: Meta = {
  title: 'Wallet/Transaction Item',
  component: 'bk-transaction-item',
  tags: ['autodocs'],
};
export default meta;

const now = Date.now();

export const Variants: StoryObj = {
  render: () =>
    html`<div style="max-width:30rem">
      <bk-transaction-item
        .data=${{ id: '1', direction: 'incoming', amount: 21000, timestamp: now - 120000, method: 'lightning', label: 'Zap from Alice' }}
      ></bk-transaction-item>
      <bk-transaction-item
        explorer
        .data=${{ id: '2', direction: 'outgoing', amount: 150000, fee: 1410, timestamp: now - 3600000, status: 'pending', confirmations: 2, txid: 'ab'.repeat(32) }}
      ></bk-transaction-item>
      <bk-transaction-item
        .data=${{ id: '3', direction: 'outgoing', amount: 5000, timestamp: now - 86400000, status: 'failed', method: 'lightning' }}
      ></bk-transaction-item>
    </div>`,
};
