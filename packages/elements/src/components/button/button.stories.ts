import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button.js';
import '../icon/icon.js';

const meta: Meta = {
  title: 'Primitives/Button',
  component: 'ou-button',
  tags: ['autodocs'],
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    label: 'Pay with bitcoin',
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  render: (a) =>
    html`<ou-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
      ?loading=${a.loading}
      >${a.label}</ou-button
    >`,
};
export default meta;

export const Primary: StoryObj = {};
export const Variants: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.75rem;flex-wrap:wrap">
      <ou-button>Primary</ou-button>
      <ou-button variant="secondary">Secondary</ou-button>
      <ou-button variant="ghost">Ghost</ou-button>
      <ou-button variant="danger">Danger</ou-button>
      <ou-button loading>Loading</ou-button>
      <ou-button disabled>Disabled</ou-button>
    </div>`,
};
export const WithIcon: StoryObj = {
  render: () =>
    html`<ou-button
      ><ou-icon slot="prefix" name="lightning"></ou-icon>Pay with Lightning</ou-button
    >`,
};
export const Sizes: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.75rem;align-items:center">
      <ou-button size="sm">Small</ou-button><ou-button>Medium</ou-button
      ><ou-button size="lg">Large</ou-button>
    </div>`,
};
