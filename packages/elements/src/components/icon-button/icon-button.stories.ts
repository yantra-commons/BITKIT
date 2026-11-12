import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './icon-button.js';

const meta: Meta = {
  title: 'Primitives/Icon Button',
  component: 'ou-icon-button',
  tags: ['autodocs'],
  args: { icon: 'qr-code', label: 'Show QR code', variant: 'ghost' },
  render: (a) =>
    html`<ou-icon-button icon=${a.icon} label=${a.label} variant=${a.variant}></ou-icon-button>`,
};
export default meta;

export const Default: StoryObj = {};
export const Variants: StoryObj = {
  render: () =>
    html`<ou-icon-button icon="copy" label="Copy"></ou-icon-button>
      <ou-icon-button icon="scan" label="Scan" variant="secondary"></ou-icon-button>
      <ou-icon-button icon="send" label="Send" variant="primary"></ou-icon-button>`,
};
