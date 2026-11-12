import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './wallet-connect.js';

const meta: Meta = {
  title: 'Wallet/Wallet Connect',
  component: 'ou-wallet-connect',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<ou-wallet-connect
      show-balance
      @ou-connect=${(e: CustomEvent) => console.log('connected via', e.detail.type)}
    ></ou-wallet-connect>`,
};
