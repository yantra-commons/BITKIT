import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './select.js';

const meta: Meta = { title: 'Primitives/Select', component: 'bk-select', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<bk-select label="Display currency" help-text="Used for fiat estimates.">
      <option value="usd">US Dollar (USD)</option>
      <option value="eur">Euro (EUR)</option>
      <option value="inr">Indian Rupee (INR)</option>
    </bk-select>`,
};
