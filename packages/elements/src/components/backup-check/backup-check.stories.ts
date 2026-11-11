import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './backup-check.js';

// Public BIP39 test vector. Never use it for real funds.
const words = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(
  ' ',
);

const meta: Meta = {
  title: 'Security/Backup Check',
  component: 'bk-backup-check',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<div style="max-width:28rem">
      <p style="font-size:.875rem">Words: ${words.map((w, i) => `${i + 1}. ${w}`).join('  ')}</p>
      <bk-backup-check .words=${[...words]}></bk-backup-check>
    </div>`,
};
