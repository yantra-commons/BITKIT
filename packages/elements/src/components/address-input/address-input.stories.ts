import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './address-input.js';

const meta: Meta = {
  title: 'Addresses/Address Input',
  component: 'bk-address-input',
  tags: ['autodocs'],
};
export default meta;

export const OnChain: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem"><bk-address-input label="Send to"></bk-address-input></div>`,
};
export const AnythingPayable: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <bk-address-input
        label="Pay"
        accept="onchain-address,bip21,bolt11,bolt12-offer,lnurl,lightning-address"
        help-text="Paste an address, Lightning invoice or Lightning Address."
      ></bk-address-input>
    </div>`,
};
export const Signet: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <bk-address-input
        network="signet"
        value="bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
      ></bk-address-input>
    </div>`,
};
