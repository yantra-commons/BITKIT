import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mnemonic-display.js';

// Public BIP39 test vector. Never use it for real funds.
const words = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(
  ' ',
);

const meta: Meta = {
  title: 'Security/Mnemonic Display',
  component: 'ou-mnemonic-display',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:32rem">
      <ou-mnemonic-display .words=${[...words]}></ou-mnemonic-display>
    </div>`,
};
