import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './copy-button.js';

const meta: Meta = {
  title: 'Primitives/Copy Button',
  component: 'ou-copy-button',
  tags: ['autodocs'],
};
export default meta;

export const Icon: StoryObj = {
  render: () =>
    html`<ou-copy-button value="bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"></ou-copy-button>`,
};
export const WithLabel: StoryObj = {
  render: () =>
    html`<ou-copy-button
      appearance="button"
      variant="secondary"
      label="Copy invoice"
      value="lnbc1..."
    ></ou-copy-button>`,
};
