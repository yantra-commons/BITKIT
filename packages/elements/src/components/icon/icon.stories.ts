import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ICON_NAMES } from './icon.js';

const meta: Meta = { title: 'Primitives/Icon', component: 'ou-icon', tags: ['autodocs'] };
export default meta;

export const Gallery: StoryObj = {
  render: () =>
    html`<div
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:1rem"
    >
      ${ICON_NAMES.map(
        (n) =>
          html`<div
            style="display:flex;flex-direction:column;align-items:center;gap:.25rem;font-size:.75rem"
          >
            <ou-icon name=${n} style="--ou-icon-size:1.75rem"></ou-icon><code>${n}</code>
          </div>`,
      )}
    </div>`,
};
