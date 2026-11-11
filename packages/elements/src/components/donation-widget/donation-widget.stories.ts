import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { MockAdapter } from '@bitkit-ui/adapters';
import './donation-widget.js';

const meta: Meta = {
  title: 'Payments/Donation Widget',
  component: 'bk-donation-widget',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <bk-donation-widget
        heading="Support open-source Bitcoin tools"
        fiat-currency="USD"
        fiat-price="97250"
        .adapter=${new MockAdapter()}
      >
        <p slot="description">Every sat helps us keep building.</p>
      </bk-donation-widget>
    </div>`,
};
