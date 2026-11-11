import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tabs.js';

const meta: Meta = { title: 'Primitives/Tabs', component: 'bk-tabs', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-tabs label="Payment method" style="max-width:24rem">
      <div slot="lightning" label="Lightning">Instant, low-fee payment.</div>
      <div slot="onchain" label="On-chain">Settles on the Bitcoin blockchain.</div>
    </bk-tabs>`,
};
