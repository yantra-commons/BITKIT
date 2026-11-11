// One-off scaffolder: writes a default story for any component that lacks one.
// Hand-written stories (with richer variants) are never overwritten.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../src/components/', import.meta.url);
const title = (n) =>
  n
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');

for (const name of readdirSync(root)) {
  const dir = new URL(`${name}/`, root);
  if (!existsSync(new URL(`${name}.ts`, dir))) continue;
  const file = new URL(`${name}.stories.ts`, dir);
  if (existsSync(file)) continue;
  writeFileSync(
    file,
    `import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './${name}.js';

const meta: Meta = { title: 'Components/${title(name)}', component: 'bk-${name}', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = { render: () => html\`<bk-${name}></bk-${name}>\` };
`,
  );
  console.log('scaffolded', name);
}
