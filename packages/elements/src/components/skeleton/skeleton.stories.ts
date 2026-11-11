import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './skeleton.js';

const meta: Meta = { title: 'Components/Skeleton', component: 'bk-skeleton', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = { render: () => html`<bk-skeleton></bk-skeleton>` };
