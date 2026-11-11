import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './qr-scanner.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Addresses/QR Scanner',
  component: 'bk-qr-scanner',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-button
        @click=${(e: Event) => {
          const s = (e.target as HTMLElement).nextElementSibling as HTMLElement & {
            active: boolean;
          };
          s.active = !s.active;
        }}
        >Toggle camera</bk-button
      >
      <bk-qr-scanner
        style="margin-top:1rem"
        @bk-scan=${(e: CustomEvent) => alert(e.detail.value)}
      ></bk-qr-scanner>`,
};
