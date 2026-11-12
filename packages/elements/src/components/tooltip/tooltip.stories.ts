import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tooltip.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Tooltip', component: 'ou-tooltip', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="padding-top:3rem">
      <ou-tooltip content="Paid to miners to include your transaction in a block.">
        <ou-button variant="secondary">What is the network fee?</ou-button>
      </ou-tooltip>
    </div>`,
};
