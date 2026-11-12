import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './badge.js';
import '../spinner/spinner.js';
import '../skeleton/skeleton.js';

const meta: Meta = {
  title: 'Primitives/Badge, Spinner & Skeleton',
  component: 'ou-badge',
  tags: ['autodocs'],
};
export default meta;

export const Badges: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <ou-badge>Draft</ou-badge><ou-badge variant="accent">New</ou-badge
      ><ou-badge variant="success">Paid</ou-badge> <ou-badge variant="warning">Pending</ou-badge
      ><ou-badge variant="danger">Expired</ou-badge><ou-badge variant="info">Testnet</ou-badge>
    </div>`,
};
export const Spinner: StoryObj = {
  render: () => html`<ou-spinner label="Waiting for payment"></ou-spinner>`,
};
export const Skeleton: StoryObj = {
  render: () =>
    html`<div style="display:grid;gap:.5rem;max-width:20rem">
      <ou-skeleton width="60%"></ou-skeleton><ou-skeleton></ou-skeleton
      ><ou-skeleton shape="rect" height="6rem"></ou-skeleton>
      <ou-skeleton shape="circle" width="3rem"></ou-skeleton>
    </div>`,
};
