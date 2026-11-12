import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { MockAdapter } from '@orange-ui/adapters';
import './donation-widget.js';

const meta: Meta = {
  title: 'Payments/Donation Widget',
  component: 'ou-donation-widget',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <ou-donation-widget
        heading="Support open-source Bitcoin tools"
        fiat-currency="USD"
        fiat-price="97250"
        .adapter=${new MockAdapter()}
      >
        <p slot="description">Every sat helps us keep building.</p>
      </ou-donation-widget>
    </div>`,
};
