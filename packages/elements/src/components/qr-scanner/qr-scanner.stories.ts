import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './qr-scanner.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Addresses/QR Scanner',
  component: 'ou-qr-scanner',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<ou-button
        @click=${(e: Event) => {
          const s = (e.target as HTMLElement).nextElementSibling as HTMLElement & {
            active: boolean;
          };
          s.active = !s.active;
        }}
        >Toggle camera</ou-button
      >
      <ou-qr-scanner
        style="margin-top:1rem"
        @ou-scan=${(e: CustomEvent) => alert(e.detail.value)}
      ></ou-qr-scanner>`,
};
