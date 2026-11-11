import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './address-display.js';

const meta: Meta = {
  title: 'Addresses/Address Display',
  component: 'bk-address-display',
  tags: ['autodocs'],
  args: {
    address: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
    truncate: 'none',
  },
  argTypes: { truncate: { control: 'select', options: ['none', 'middle'] } },
  render: (a) =>
    html`<div style="max-width:28rem">
      <bk-address-display
        address=${a.address}
        truncate=${a.truncate}
        label="Your deposit address"
        qr
        explorer
        show-network
        show-type
      ></bk-address-display>
    </div>`,
};
export default meta;

export const Default: StoryObj = {};
export const Truncated: StoryObj = { args: { truncate: 'middle' } };
export const Testnet: StoryObj = {
  args: { address: 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7' },
};
export const Invalid: StoryObj = { args: { address: 'bc1qthisisnotvalid' } };
