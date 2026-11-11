import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tooltip.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Tooltip', component: 'bk-tooltip', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="padding-top:3rem">
      <bk-tooltip content="Paid to miners to include your transaction in a block.">
        <bk-button variant="secondary">What is the network fee?</bk-button>
      </bk-tooltip>
    </div>`,
};
