import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { MockAdapter } from '@bitkit-ui/adapters';
import './pay-button.js';

const meta: Meta = { title: 'Payments/Pay Button', component: 'bk-pay-button', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-pay-button
      amount="21000"
      description="Coffee"
      fiat-currency="USD"
      fiat-price="97250"
      .adapter=${new MockAdapter({ stepMs: 4000 })}
    ></bk-pay-button>`,
};
export const FiatPriced: StoryObj = {
  render: () =>
    html`<bk-pay-button fiat-amount="25" fiat-currency="USD" .adapter=${new MockAdapter()} size="lg"
      >Buy for $25</bk-pay-button
    >`,
};
