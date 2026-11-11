import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { encodeUnsignedBolt11 } from '@bitkit-ui/core';
import './invoice-display.js';

const fresh = () =>
  encodeUnsignedBolt11({
    network: 'mainnet',
    amountMsat: 250_000_000n,
    timestamp: Math.floor(Date.now() / 1000),
    paymentHash: new Uint8Array(32).fill(7),
    paymentSecret: new Uint8Array(32).fill(3),
    description: '1 cup coffee',
    expiry: 600,
  });

const meta: Meta = {
  title: 'Payments/Invoice Display',
  component: 'bk-invoice-display',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:26rem">
      <bk-invoice-display qr .invoice=${fresh()}></bk-invoice-display>
    </div>`,
};
export const SpecExample: StoryObj = {
  name: 'BOLT11 spec example (expired)',
  render: () =>
    html`<div style="max-width:26rem">
      <bk-invoice-display
        invoice="lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh"
      ></bk-invoice-display>
    </div>`,
};
export const Invalid: StoryObj = {
  render: () => html`<bk-invoice-display invoice="lnbc1notvalid"></bk-invoice-display>`,
};
