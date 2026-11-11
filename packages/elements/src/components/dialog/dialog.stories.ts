import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dialog.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Dialog', component: 'bk-dialog', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-button
        @click=${(e: Event) => ((e.target as HTMLElement).nextElementSibling as HTMLElement & { show(): void }).show()}
        >Open dialog</bk-button
      >
      <bk-dialog label="Confirm payment">
        <p>Send 21,000 sats to alice@example.com?</p>
        <bk-button
          slot="footer"
          variant="secondary"
          @click=${(e: Event) => (e.target as HTMLElement).closest('bk-dialog')!.hide()}
          >Cancel</bk-button
        >
        <bk-button slot="footer">Send</bk-button>
      </bk-dialog>`,
};
