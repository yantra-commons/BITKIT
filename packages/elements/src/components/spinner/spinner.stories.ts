import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spinner.js';

const meta: Meta = { title: 'Components/Spinner', component: 'ou-spinner', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = { render: () => html`<ou-spinner></ou-spinner>` };
