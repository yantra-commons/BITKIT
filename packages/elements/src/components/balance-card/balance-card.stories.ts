import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './balance-card.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Wallet/Balance Card',
  component: 'ou-balance-card',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem">
      <ou-balance-card balance="2450000" pending="21000" fiat-currency="USD" fiat-price="97250">
        <div slot="actions">
          <ou-button>Send</ou-button><ou-button variant="secondary">Receive</ou-button>
        </div>
      </ou-balance-card>
    </div>`,
};
export const Loading: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem"><ou-balance-card loading></ou-balance-card></div>`,
};
