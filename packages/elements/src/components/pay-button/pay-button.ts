import { css, html, nothing } from 'lit';
import type { FiatRate } from '@orange-ui/core';
import type { PaymentAdapter, PaymentMethod } from '@orange-ui/adapters';
import { OrangeElement } from '../../internal/base.js';
import { bigintConverter, listConverter } from '../../internal/converters.js';
import { define } from '../../internal/define.js';
import { baseStyles } from '../../internal/styles.js';
import { iconSvg } from '../icon/icon.js';
import '../button/button.js';
import '../checkout/checkout.js';

/**
 * @summary Drop-in "Pay with bitcoin" button. Give it an amount and an adapter; clicking opens
 * the checkout in a modal. All checkout events (`ou-paid`, `ou-status-change`, …) bubble out.
 *
 * ```html
 * <ou-pay-button amount="21000" adapter="mock" description="Coffee"></ou-pay-button>
 * ```
 * @tag ou-pay-button
 * @slot - Button label. Default "Pay with bitcoin".
 * @csspart button - The ou-button.
 * @csspart checkout - The ou-checkout.
 */
export class OuPayButton extends OrangeElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      :host([block]) {
        display: block;
      }
      .ico {
        display: inline-flex;
        width: 1.2em;
        height: 1.2em;
      }
      .ico svg {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  static override properties = {
    adapter: {},
    amount: { converter: bigintConverter },
    fiatAmount: { type: String, attribute: 'fiat-amount' },
    fiatCurrency: { type: String, attribute: 'fiat-currency' },
    fiatPrice: { type: String, attribute: 'fiat-price' },
    fiatRate: { attribute: false },
    description: { type: String },
    orderId: { type: String, attribute: 'order-id' },
    methods: { converter: listConverter },
    variant: { type: String },
    size: { type: String },
    block: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    heading: { type: String },
    open: { type: Boolean, reflect: true },
  };

  declare adapter: PaymentAdapter | string | undefined;
  declare amount: bigint | undefined;
  declare fiatAmount: string | undefined;
  declare fiatCurrency: string | undefined;
  declare fiatPrice: string | undefined;
  declare fiatRate: FiatRate | undefined;
  declare description: string | undefined;
  declare orderId: string | undefined;
  declare methods: PaymentMethod[];
  declare variant: 'primary' | 'secondary';
  declare size: 'sm' | 'md' | 'lg';
  declare block: boolean;
  declare disabled: boolean;
  declare heading: string | undefined;
  /** Whether the checkout modal is open. */
  declare open: boolean;

  constructor() {
    super();
    this.methods = ['lightning', 'onchain'];
    this.variant = 'primary';
    this.size = 'md';
    this.block = false;
    this.disabled = false;
    this.open = false;
  }

  override render() {
    return html`<ou-button
        part="button"
        variant=${this.variant}
        size=${this.size}
        ?block=${this.block}
        ?disabled=${this.disabled}
        aria-haspopup="dialog"
        @click=${() => (this.open = true)}
        ><span class="ico" slot="prefix">${iconSvg('bitcoin-circle')}</span
        ><slot>Pay with bitcoin</slot></ou-button
      >
      <ou-checkout
        part="checkout"
        mode="modal"
        .adapter=${this.adapter}
        .amount=${this.amount}
        .fiatRate=${this.fiatRate}
        .methods=${this.methods}
        fiat-amount=${this.fiatAmount ?? nothing}
        fiat-currency=${this.fiatCurrency ?? nothing}
        fiat-price=${this.fiatPrice ?? nothing}
        description=${this.description ?? nothing}
        order-id=${this.orderId ?? nothing}
        heading=${this.heading ?? nothing}
        ?open=${this.open}
        @ou-close=${() => (this.open = false)}
      ></ou-checkout>`;
  }
}

define('ou-pay-button', OuPayButton);

declare global {
  interface HTMLElementTagNameMap {
    'ou-pay-button': OuPayButton;
  }
}
