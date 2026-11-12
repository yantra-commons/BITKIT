import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './fee-selector.js';

const meta: Meta = {
  title: 'Wallet/Fee Selector',
  component: 'ou-fee-selector',
  tags: ['autodocs'],
};
export default meta;

export const Static: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <ou-fee-selector
        vsize="141"
        fiat-currency="USD"
        fiat-price="97250"
        .fees=${{ fastestFee: 24, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 }}
      ></ou-fee-selector>
    </div>`,
};
export const LiveMempool: StoryObj = {
  name: 'Live (mempool.space)',
  render: () =>
    html`<div style="max-width:28rem"><ou-fee-selector vsize="141"></ou-fee-selector></div>`,
};
