import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './lightning-address-card.js';

const meta: Meta = {
  title: 'Payments/Lightning Address Card',
  component: 'ou-lightning-address-card',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:22rem">
      <ou-lightning-address-card
        address="satoshi@example.com"
        name="Satoshi"
        description="Tips keep the lights on ⚡"
      ></ou-lightning-address-card>
    </div>`,
};
