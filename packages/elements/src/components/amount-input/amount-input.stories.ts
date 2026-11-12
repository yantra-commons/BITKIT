import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './amount-input.js';

const meta: Meta = {
  title: 'Amounts/Amount Input',
  component: 'ou-amount-input',
  tags: ['autodocs'],
  args: { label: 'Amount', min: '1000', balance: '250000' },
  render: (a) =>
    html`<div style="max-width:24rem">
      <ou-amount-input
        label=${a.label}
        min=${a.min}
        balance=${a.balance}
        fiat-currency="USD"
        fiat-price="97250.12"
        @ou-change=${(e: CustomEvent) => console.log('ou-change', e.detail)}
      ></ou-amount-input>
    </div>`,
};
export default meta;

export const Default: StoryObj = {};
export const FiatFirst: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem">
      <ou-amount-input
        label="Amount"
        unit="fiat"
        fiat-currency="EUR"
        fiat-price="90000"
        locale="de-DE"
      ></ou-amount-input>
    </div>`,
};
export const LightningMsat: StoryObj = {
  render: () =>
    html`<div style="max-width:24rem">
      <ou-amount-input label="Amount" allow-msat .units=${['sats']}></ou-amount-input>
    </div>`,
};
