import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mnemonic-input.js';

const meta: Meta = {
  title: 'Security/Mnemonic Input',
  component: 'ou-mnemonic-input',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:32rem">
      <p style="font-size:.875rem">
        Try pasting the public BIP39 test vector:
        <code>legal winner thank year wave sausage worth useful legal winner thank yellow</code>
      </p>
      <ou-mnemonic-input></ou-mnemonic-input>
    </div>`,
};
export const Masked: StoryObj = {
  render: () =>
    html`<div style="max-width:32rem"><ou-mnemonic-input masked></ou-mnemonic-input></div>`,
};
