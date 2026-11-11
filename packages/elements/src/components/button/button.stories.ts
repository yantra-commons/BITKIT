import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button.js';
import '../icon/icon.js';

const meta: Meta = {
  title: 'Primitives/Button',
  component: 'bk-button',
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
    html`<bk-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
      ?loading=${a.loading}
      >${a.label}</bk-button
    >`,
};
export default meta;

export const Primary: StoryObj = {};
export const Variants: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.75rem;flex-wrap:wrap">
      <bk-button>Primary</bk-button>
      <bk-button variant="secondary">Secondary</bk-button>
      <bk-button variant="ghost">Ghost</bk-button>
      <bk-button variant="danger">Danger</bk-button>
      <bk-button loading>Loading</bk-button>
      <bk-button disabled>Disabled</bk-button>
    </div>`,
};
export const WithIcon: StoryObj = {
  render: () =>
    html`<bk-button
      ><bk-icon slot="prefix" name="lightning"></bk-icon>Pay with Lightning</bk-button
    >`,
};
export const Sizes: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.75rem;align-items:center">
      <bk-button size="sm">Small</bk-button><bk-button>Medium</bk-button
      ><bk-button size="lg">Large</bk-button>
    </div>`,
};
