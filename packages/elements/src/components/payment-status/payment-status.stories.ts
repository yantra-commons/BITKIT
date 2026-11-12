import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './payment-status.js';

const meta: Meta = {
  title: 'Payments/Payment Status',
  component: 'ou-payment-status',
  tags: ['autodocs'],
  args: { status: 'confirming', confirmations: 2, requiredConfirmations: 3, size: 'compact' },
  argTypes: {
    status: {
      control: 'select',
      options: [
        'pending',
        'detected',
        'confirming',
        'paid',
        'underpaid',
        'overpaid',
        'expired',
        'failed',
        'cancelled',
      ],
    },
    size: { control: 'select', options: ['compact', 'large'] },
  },
  render: (a) =>
    html`<ou-payment-status
      status=${a.status}
      size=${a.size}
      confirmations=${a.confirmations}
      required-confirmations=${a.requiredConfirmations}
      amount-received="12000"
      amount-due="21000"
    ></ou-payment-status>`,
};
export default meta;

export const Playground: StoryObj = {};
export const AllStates: StoryObj = {
  render: () =>
    html`<div style="display:grid;gap:.75rem;max-width:28rem">
      ${[
        'pending',
        'detected',
        'confirming',
        'paid',
        'underpaid',
        'overpaid',
        'expired',
        'failed',
        'cancelled',
      ].map(
        (s) =>
          html`<ou-payment-status
            status=${s}
            confirmations="1"
            required-confirmations="3"
            amount-received="12000"
            amount-due="21000"
          ></ou-payment-status>`,
      )}
    </div>`,
};
export const Success: StoryObj = {
  render: () => html`<ou-payment-status status="paid" size="large"></ou-payment-status>`,
};
