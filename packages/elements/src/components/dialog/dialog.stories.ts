import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dialog.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Dialog', component: 'ou-dialog', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<ou-button
        @click=${(e: Event) => ((e.target as HTMLElement).nextElementSibling as HTMLElement & { show(): void }).show()}
        >Open dialog</ou-button
      >
      <ou-dialog label="Confirm payment">
        <p>Send 21,000 sats to alice@example.com?</p>
        <ou-button
          slot="footer"
          variant="secondary"
          @click=${(e: Event) => (e.target as HTMLElement).closest('ou-dialog')!.hide()}
          >Cancel</ou-button
        >
        <ou-button slot="footer">Send</ou-button>
      </ou-dialog>`,
};
