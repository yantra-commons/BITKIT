import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './amount-display.js';

const meta: Meta = {
  title: 'Amounts/Amount Display',
  component: 'ou-amount-display',
  tags: ['autodocs'],
  args: {
    amount: '1234567',
    unit: 'sats',
    size: 'xl',
    toggle: true,
    showFiat: true,
    privacyToggle: true,
  },
  argTypes: {
    unit: { control: 'select', options: ['sats', 'btc', 'fiat', 'auto', 'mbtc', 'bits'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
  },
  render: (a) =>
    html`<ou-amount-display
      amount=${a.amount}
      unit=${a.unit}
      size=${a.size}
      ?toggle=${a.toggle}
      ?show-fiat=${a.showFiat}
      ?privacy-toggle=${a.privacyToggle}
      fiat-currency="USD"
      fiat-price="97250.12"
    ></ou-amount-display>`,
};
export default meta;

export const Playground: StoryObj = {};
export const Units: StoryObj = {
  render: () =>
    html`<div style="display:grid;gap:.75rem">
      <ou-amount-display amount="21000"></ou-amount-display>
      <ou-amount-display amount="250000" unit="btc"></ou-amount-display>
      <ou-amount-display amount="250000" unit="btc" btc-style="symbol"></ou-amount-display>
      <ou-amount-display amount="12345678" unit="auto" locale="en-IN"></ou-amount-display>
      <ou-amount-display
        amount="50000"
        unit="fiat"
        fiat-currency="EUR"
        fiat-price="90000"
        locale="de-DE"
      ></ou-amount-display>
      <ou-amount-display
        amount="21000"
        direction="incoming"
        sign-display="always"
      ></ou-amount-display>
    </div>`,
};
export const Loading: StoryObj = {
  render: () => html`<ou-amount-display loading size="xl"></ou-amount-display>`,
};
