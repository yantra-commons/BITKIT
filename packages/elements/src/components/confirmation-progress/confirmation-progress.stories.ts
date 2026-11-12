import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './confirmation-progress.js';

const meta: Meta = {
  title: 'Wallet/Confirmation Progress',
  component: 'ou-confirmation-progress',
  tags: ['autodocs'],
};
export default meta;

export const Steps: StoryObj = {
  render: () =>
    html`<div style="display:grid;gap:.5rem">
      ${[0, 1, 2, 3, 4, 5, 6].map((n) => html`<ou-confirmation-progress confirmations=${n} show-eta></ou-confirmation-progress>`)}
    </div>`,
};
