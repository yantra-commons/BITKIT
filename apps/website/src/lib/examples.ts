/**
 * Live example per component. `html` is rendered in the docs preview and converted into
 * React/Vue code tabs; `js` documents property assignments that cannot be expressed as
 * attributes (the same setup runs in src/scripts/demo-setup.ts).
 */
export interface Example {
  html: string;
  js?: string;
}

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

export const examples: Record<string, Example> = {
  button: {
    html: `<ou-button>Pay with bitcoin</ou-button>
<ou-button variant="secondary">Receive</ou-button>
<ou-button variant="ghost">Cancel</ou-button>
<ou-button loading>Sending</ou-button>`,
  },
  'icon-button': { html: `<ou-icon-button icon="qr-code" label="Show QR code"></ou-icon-button>` },
  icon: {
    html: `<ou-icon name="lightning" label="Lightning"></ou-icon>\n<ou-icon name="bitcoin-circle"></ou-icon>`,
  },
  input: {
    html: `<ou-input label="Note" placeholder="Coffee with Satoshi" help-text="Only visible to you."></ou-input>`,
  },
  select: {
    html: `<ou-select label="Display currency">
  <option value="usd">US Dollar</option>
  <option value="eur">Euro</option>
</ou-select>`,
  },
  dialog: {
    html: `<ou-button id="open-dialog">Open dialog</ou-button>
<ou-dialog id="demo-dialog" label="Confirm payment">
  <p>Send 21,000 sats to alice@example.com?</p>
  <ou-button slot="footer">Send</ou-button>
</ou-dialog>`,
    js: `document.querySelector('#open-dialog').addEventListener('click', () => {
  document.querySelector('#demo-dialog').show();
});`,
  },
  tooltip: {
    html: `<ou-tooltip content="Paid to miners to include your transaction in a block.">
  <ou-button variant="secondary">Network fee</ou-button>
</ou-tooltip>`,
  },
  toast: {
    html: `<ou-button id="toast-btn">Show toast</ou-button>`,
    js: `import { toast } from '@orange-ui/elements';
document.querySelector('#toast-btn').addEventListener('click', () => {
  toast('Payment received: 21,000 sats', { variant: 'success' });
});`,
  },
  toaster: { html: `<ou-toast variant="success" duration="0">Payment received</ou-toast>` },
  tabs: {
    html: `<ou-tabs label="Payment method">
  <div slot="lightning" label="Lightning">Instant, low fees.</div>
  <div slot="onchain" label="On-chain">Settles on the blockchain.</div>
</ou-tabs>`,
  },
  badge: {
    html: `<ou-badge variant="success">Paid</ou-badge>\n<ou-badge variant="warning">Pending</ou-badge>\n<ou-badge variant="info">Testnet</ou-badge>`,
  },
  spinner: { html: `<ou-spinner label="Waiting for payment"></ou-spinner>` },
  skeleton: {
    html: `<ou-skeleton width="60%"></ou-skeleton>\n<ou-skeleton shape="rect" height="4rem"></ou-skeleton>`,
  },
  'copy-button': {
    html: `<ou-copy-button value="bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" appearance="button" variant="secondary"></ou-copy-button>`,
  },
  'qr-code': {
    html: `<ou-qr-code value="BITCOIN:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4?amount=0.0025" label="payment request" size="200"></ou-qr-code>`,
  },
  'amount-display': {
    html: `<ou-amount-display amount="1234567" size="xl" toggle show-fiat privacy-toggle fiat-currency="USD" fiat-price="97250"></ou-amount-display>`,
  },
  'amount-input': {
    html: `<ou-amount-input label="Amount" min="1000" balance="250000" fiat-currency="USD" fiat-price="97250"></ou-amount-input>`,
  },
  'address-display': {
    html: `<ou-address-display address="bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0" label="Deposit address" qr explorer show-type></ou-address-display>`,
  },
  'address-input': {
    html: `<ou-address-input label="Send to" accept="onchain-address,bip21,bolt11,lightning-address"></ou-address-input>`,
  },
  'qr-scanner': { html: `<ou-qr-scanner></ou-qr-scanner>` },
  'network-badge': {
    html: `<ou-network-badge network="mainnet"></ou-network-badge>\n<ou-network-badge network="signet"></ou-network-badge>\n<ou-network-badge network="regtest"></ou-network-badge>`,
  },
  'pay-button': {
    html: `<ou-pay-button amount="21000" adapter="mock" description="Flat white" fiat-currency="USD" fiat-price="97250"></ou-pay-button>`,
  },
  checkout: {
    html: `<ou-checkout amount="21000" adapter="mock" description="Coffee and pastry" fiat-currency="USD" fiat-price="97250"></ou-checkout>`,
  },
  'invoice-display': {
    html: `<ou-invoice-display id="invoice-demo" qr></ou-invoice-display>`,
    js: `document.querySelector('#invoice-demo').invoice = 'lnbc2500u1p…'; // any BOLT11 invoice`,
  },
  'payment-status': {
    html: `<ou-payment-status status="confirming" confirmations="2" required-confirmations="3"></ou-payment-status>
<ou-payment-status status="underpaid" amount-received="12000" amount-due="21000"></ou-payment-status>`,
  },
  'donation-widget': {
    html: `<ou-donation-widget adapter="mock" fiat-currency="USD" fiat-price="97250"></ou-donation-widget>`,
  },
  'lightning-address-card': {
    html: `<ou-lightning-address-card address="satoshi@example.com" name="Satoshi" description="Tips keep the lights on"></ou-lightning-address-card>`,
  },
  'wallet-connect': { html: `<ou-wallet-connect show-balance></ou-wallet-connect>` },
  'balance-card': {
    html: `<ou-balance-card balance="2450000" pending="21000" fiat-currency="USD" fiat-price="97250"></ou-balance-card>`,
  },
  'transaction-list': {
    html: `<ou-transaction-list id="tx-list" interactive></ou-transaction-list>`,
    js: `document.querySelector('#tx-list').transactions = [
  { id: 'a', direction: 'incoming', amount: 21000, timestamp: Date.now() - 300000, method: 'lightning', label: 'Coffee refund' },
  { id: 'b', direction: 'outgoing', amount: 50000, fee: 420, timestamp: Date.now() - 7200000, status: 'pending', confirmations: 1 },
];`,
  },
  'transaction-item': {
    html: `<ou-transaction-item direction="incoming" amount="21000" method="lightning" label="Zap from Alice"></ou-transaction-item>`,
  },
  'confirmation-progress': {
    html: `<ou-confirmation-progress confirmations="2" required="6" show-eta></ou-confirmation-progress>`,
  },
  'fee-selector': {
    html: `<ou-fee-selector id="fees" vsize="141" fiat-currency="USD" fiat-price="97250"></ou-fee-selector>`,
    js: `// Uses mempool.space by default. For a fixed demo:
document.querySelector('#fees').fees = { fastestFee: 24, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 };`,
  },
  'utxo-list': {
    html: `<ou-utxo-list id="utxos" target="60000"></ou-utxo-list>`,
    js: `document.querySelector('#utxos').utxos = [
  { txid: 'aa…', vout: 0, value: 50000, confirmations: 120, label: 'Exchange withdrawal' },
  { txid: 'bb…', vout: 1, value: 20000, confirmations: 3 },
];`,
  },
  'mnemonic-display': {
    html: `<ou-mnemonic-display id="phrase"></ou-mnemonic-display>`,
    js: `// Property only — never an attribute. Public BIP39 test vector, never use for funds.
document.querySelector('#phrase').words = '${PHRASE}'.split(' ');`,
  },
  'mnemonic-input': { html: `<ou-mnemonic-input></ou-mnemonic-input>` },
  'backup-check': {
    html: `<ou-backup-check id="check"></ou-backup-check>`,
    js: `document.querySelector('#check').words = '${PHRASE}'.split(' ');`,
  },
};
