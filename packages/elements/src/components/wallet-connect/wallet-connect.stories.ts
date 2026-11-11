import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './wallet-connect.js';

const meta: Meta = {
  title: 'Wallet/Wallet Connect',
  component: 'bk-wallet-connect',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-wallet-connect
      show-balance
      @bk-connect=${(e: CustomEvent) => console.log('connected via', e.detail.type)}
    ></bk-wallet-connect>`,
};
