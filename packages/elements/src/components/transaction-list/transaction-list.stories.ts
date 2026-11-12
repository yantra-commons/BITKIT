import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TransactionData } from '../transaction-item/transaction-item.js';
import './transaction-list.js';

const now = Date.now();
const txs: TransactionData[] = [
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
    timestamp: now - 86400000 * 1.2,
    label: 'Salary',
  },
  {
    id: 'd',
    direction: 'outgoing',
    amount: 99000,
    timestamp: now - 86400000 * 9,
    method: 'lightning',
    label: 'VPN subscription',
  },
];

const meta: Meta = {
  title: 'Wallet/Transaction List',
  component: 'ou-transaction-list',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:32rem">
      <ou-transaction-list interactive has-more .transactions=${txs}></ou-transaction-list>
    </div>`,
};
export const Empty: StoryObj = { render: () => html`<ou-transaction-list></ou-transaction-list>` };
export const Loading: StoryObj = {
  render: () => html`<ou-transaction-list loading></ou-transaction-list>`,
};
