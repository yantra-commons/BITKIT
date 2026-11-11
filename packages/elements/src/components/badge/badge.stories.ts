import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './badge.js';
import '../spinner/spinner.js';
import '../skeleton/skeleton.js';

const meta: Meta = {
  title: 'Primitives/Badge, Spinner & Skeleton',
  component: 'bk-badge',
  tags: ['autodocs'],
};
export default meta;

export const Badges: StoryObj = {
  render: () =>
    html`<div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <bk-badge>Draft</bk-badge><bk-badge variant="accent">New</bk-badge
      ><bk-badge variant="success">Paid</bk-badge> <bk-badge variant="warning">Pending</bk-badge
      ><bk-badge variant="danger">Expired</bk-badge><bk-badge variant="info">Testnet</bk-badge>
    </div>`,
};
export const Spinner: StoryObj = {
  render: () => html`<bk-spinner label="Waiting for payment"></bk-spinner>`,
};
export const Skeleton: StoryObj = {
  render: () =>
    html`<div style="display:grid;gap:.5rem;max-width:20rem">
      <bk-skeleton width="60%"></bk-skeleton><bk-skeleton></bk-skeleton
      ><bk-skeleton shape="rect" height="6rem"></bk-skeleton>
      <bk-skeleton shape="circle" width="3rem"></bk-skeleton>
    </div>`,
};
