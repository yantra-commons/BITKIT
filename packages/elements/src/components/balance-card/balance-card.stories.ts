import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './balance-card.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Wallet/Balance Card',
  component: 'bk-balance-card',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem">
      <bk-balance-card balance="2450000" pending="21000" fiat-currency="USD" fiat-price="97250">
        <div slot="actions">
          <bk-button>Send</bk-button><bk-button variant="secondary">Receive</bk-button>
        </div>
      </bk-balance-card>
    </div>`,
};
export const Loading: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem"><bk-balance-card loading></bk-balance-card></div>`,
};
