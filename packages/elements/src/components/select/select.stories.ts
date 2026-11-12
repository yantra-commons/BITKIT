import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './select.js';

const meta: Meta = { title: 'Primitives/Select', component: 'ou-select', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<ou-select label="Display currency" help-text="Used for fiat estimates.">
      <option value="usd">US Dollar (USD)</option>
      <option value="eur">Euro (EUR)</option>
      <option value="inr">Indian Rupee (INR)</option>
    </ou-select>`,
};
