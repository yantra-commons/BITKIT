import type { Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components';
import { html } from 'lit';
import manifest from '../custom-elements.json' with { type: 'json' };
import '../src/index.js';

setCustomElementsManifest(manifest);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (story, ctx) =>
      html`<div
        data-bk-theme=${ctx.globals.theme ?? 'light'}
        style="padding: 1.5rem; background: var(--bk-color-bg); color: var(--bk-color-text); min-height: 100%; font-family: var(--bk-font-sans)"
      >
        ${story()}
      </div>`,
  ],
  parameters: { controls: { expanded: true }, layout: 'fullscreen' },
};

export default preview;
