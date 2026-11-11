import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast } from './toast.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Toast', component: 'bk-toast', tags: ['autodocs'] };
export default meta;

export const Variants: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <bk-button @click=${() => toast('Payment received: 21,000 sats', { variant: 'success' })}
        >Success</bk-button
      >
      <bk-button variant="secondary" @click=${() => toast('Invoice copied')}>Info</bk-button>
      <bk-button
        variant="secondary"
        @click=${() => toast('Fees are high right now', { variant: 'warning' })}
        >Warning</bk-button
      >
      <bk-button
        variant="danger"
        @click=${() => toast('Payment failed. No funds were sent.', { variant: 'danger', duration: 0 })}
        >Error</bk-button
      >
    </div>`,
};

export const Static: StoryObj = {
  render: () => html`<bk-toast variant="success" duration="0">Payment received</bk-toast>`,
};
