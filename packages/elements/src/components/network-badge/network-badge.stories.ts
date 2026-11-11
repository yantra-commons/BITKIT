import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './network-badge.js';

const meta: Meta = {
  title: 'Addresses/Network Badge',
  component: 'bk-network-badge',
  tags: ['autodocs'],
};
export default meta;

export const All: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.5rem">
      ${['mainnet', 'testnet', 'testnet4', 'signet', 'regtest'].map((n) => html`<bk-network-badge network=${n}></bk-network-badge>`)}
    </div>`,
};
