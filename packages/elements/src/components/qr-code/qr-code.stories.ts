import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './qr-code.js';

const meta: Meta = {
  title: 'Primitives/QR Code',
  component: 'ou-qr-code',
  tags: ['autodocs'],
  args: { value: 'BITCOIN:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4?amount=0.0025', size: 240 },
  render: (a) =>
    html`<ou-qr-code value=${a.value} size=${a.size} label="payment request"></ou-qr-code>`,
};
export default meta;

export const Default: StoryObj = {};
export const WithLogo: StoryObj = {
  render: () =>
    html`<ou-qr-code value="bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" size="240">
      <svg slot="logo" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="32" fill="#F7931A" />
        <text
          x="32"
          y="44"
          font-size="36"
          text-anchor="middle"
          fill="#fff"
          font-family="sans-serif"
        >
          ₿
        </text>
      </svg>
    </ou-qr-code>`,
};
