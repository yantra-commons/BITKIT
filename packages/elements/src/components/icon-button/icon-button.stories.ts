import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './icon-button.js';

const meta: Meta = {
  title: 'Primitives/Icon Button',
  component: 'bk-icon-button',
  tags: ['autodocs'],
  args: { icon: 'qr-code', label: 'Show QR code', variant: 'ghost' },
  render: (a) =>
    html`<bk-icon-button icon=${a.icon} label=${a.label} variant=${a.variant}></bk-icon-button>`,
};
export default meta;

export const Default: StoryObj = {};
export const Variants: StoryObj = {
  render: () =>
    html`<bk-icon-button icon="copy" label="Copy"></bk-icon-button>
      <bk-icon-button icon="scan" label="Scan" variant="secondary"></bk-icon-button>
      <bk-icon-button icon="send" label="Send" variant="primary"></bk-icon-button>`,
};
