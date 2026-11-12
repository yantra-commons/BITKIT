import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './input.js';

const meta: Meta = {
  title: 'Primitives/Input',
  component: 'ou-input',
  tags: ['autodocs'],
  args: {
    label: 'Note to self',
    placeholder: 'Coffee with Satoshi',
    helpText: 'Only visible to you.',
    error: '',
  },
  render: (a) =>
    html`<ou-input
      label=${a.label}
      placeholder=${a.placeholder}
      help-text=${a.helpText}
      error=${a.error}
    ></ou-input>`,
};
export default meta;

export const Default: StoryObj = {};
export const WithError: StoryObj = { args: { error: 'Notes can be at most 140 characters.' } };
export const Monospace: StoryObj = {
  render: () =>
    html`<ou-input
      label="Transaction ID"
      monospace
      value="4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
      readonly
    ></ou-input>`,
};
