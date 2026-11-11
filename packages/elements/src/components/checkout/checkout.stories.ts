import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { MockAdapter, type MockScenario } from '@bitkit-ui/adapters';
import './checkout.js';

const meta: Meta = {
  title: 'Payments/Checkout',
  component: 'bk-checkout',
  tags: ['autodocs'],
  args: { amount: '21000', description: 'Coffee & pastry', scenario: 'lightning' },
  argTypes: {
    scenario: {
      control: 'select',
      options: ['lightning', 'onchain', 'underpaid', 'overpaid', 'expired', 'failed', 'manual'],
    },
  },
  render: (a) =>
    html`<div style="max-width:26rem">
      <bk-checkout
        amount=${a.amount}
        description=${a.description}
        fiat-currency="USD"
        fiat-price="97250"
        .adapter=${new MockAdapter({ scenario: a.scenario as MockScenario, stepMs: 2500 })}
      ></bk-checkout>
    </div>`,
};
export default meta;

export const Inline: StoryObj = {};
export const OnChainConfirmations: StoryObj = { args: { scenario: 'onchain' } };
export const Underpaid: StoryObj = { args: { scenario: 'underpaid' } };
export const Expired: StoryObj = { args: { scenario: 'expired' } };
export const LightningOnly: StoryObj = {
  render: () =>
    html`<div style="max-width:26rem">
      <bk-checkout
        amount="5000"
        methods="lightning"
        .adapter=${new MockAdapter({ scenario: 'manual' })}
      ></bk-checkout>
    </div>`,
};
