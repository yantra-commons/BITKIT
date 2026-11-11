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
    html: `<bk-button>Pay with bitcoin</bk-button>
<bk-button variant="secondary">Receive</bk-button>
<bk-button variant="ghost">Cancel</bk-button>
<bk-button loading>Sending</bk-button>`,
  },
  'icon-button': { html: `<bk-icon-button icon="qr-code" label="Show QR code"></bk-icon-button>` },
  icon: {
    html: `<bk-icon name="lightning" label="Lightning"></bk-icon>\n<bk-icon name="bitcoin-circle"></bk-icon>`,
  },
  input: {
    html: `<bk-input label="Note" placeholder="Coffee with Satoshi" help-text="Only visible to you."></bk-input>`,
  },
  select: {
    html: `<bk-select label="Display currency">
  <option value="usd">US Dollar</option>
  <option value="eur">Euro</option>
</bk-select>`,
  },
  dialog: {
    html: `<bk-button id="open-dialog">Open dialog</bk-button>
<bk-dialog id="demo-dialog" label="Confirm payment">
  <p>Send 21,000 sats to alice@example.com?</p>
  <bk-button slot="footer">Send</bk-button>
</bk-dialog>`,
    js: `document.querySelector('#open-dialog').addEventListener('click', () => {
  document.querySelector('#demo-dialog').show();
});`,
  },
  tooltip: {
    html: `<bk-tooltip content="Paid to miners to include your transaction in a block.">
  <bk-button variant="secondary">Network fee</bk-button>
</bk-tooltip>`,
  },
  toast: {
    html: `<bk-button id="toast-btn">Show toast</bk-button>`,
    js: `import { toast } from '@bitkit-ui/elements';
document.querySelector('#toast-btn').addEventListener('click', () => {
  toast('Payment received: 21,000 sats', { variant: 'success' });
});`,
  },
  toaster: { html: `<bk-toast variant="success" duration="0">Payment received</bk-toast>` },
  tabs: {
    html: `<bk-tabs label="Payment method">
  <div slot="lightning" label="Lightning">Instant, low fees.</div>
  <div slot="onchain" label="On-chain">Settles on the blockchain.</div>
</bk-tabs>`,
  },
  badge: {
    html: `<bk-badge variant="success">Paid</bk-badge>\n<bk-badge variant="warning">Pending</bk-badge>\n<bk-badge variant="info">Testnet</bk-badge>`,
  },
  spinner: { html: `<bk-spinner label="Waiting for payment"></bk-spinner>` },
  skeleton: {
    html: `<bk-skeleton width="60%"></bk-skeleton>\n<bk-skeleton shape="rect" height="4rem"></bk-skeleton>`,
  },
  'copy-button': {
    html: `<bk-copy-button value="bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" appearance="button" variant="secondary"></bk-copy-button>`,
  },
  'qr-code': {
    html: `<bk-qr-code value="BITCOIN:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4?amount=0.0025" label="payment request" size="200"></bk-qr-code>`,
  },
  'amount-display': {
    html: `<bk-amount-display amount="1234567" size="xl" toggle show-fiat privacy-toggle fiat-currency="USD" fiat-price="97250"></bk-amount-display>`,
  },
  'amount-input': {
    html: `<bk-amount-input label="Amount" min="1000" balance="250000" fiat-currency="USD" fiat-price="97250"></bk-amount-input>`,
  },
  'address-display': {
    html: `<bk-address-display address="bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0" label="Deposit address" qr explorer show-type></bk-address-display>`,
  },
  'address-input': {
    html: `<bk-address-input label="Send to" accept="onchain-address,bip21,bolt11,lightning-address"></bk-address-input>`,
  },
  'qr-scanner': { html: `<bk-qr-scanner></bk-qr-scanner>` },
  'network-badge': {
    html: `<bk-network-badge network="mainnet"></bk-network-badge>\n<bk-network-badge network="signet"></bk-network-badge>\n<bk-network-badge network="regtest"></bk-network-badge>`,
  },
  'pay-button': {
    html: `<bk-pay-button amount="21000" adapter="mock" description="Flat white" fiat-currency="USD" fiat-price="97250"></bk-pay-button>`,
  },
  checkout: {
    html: `<bk-checkout amount="21000" adapter="mock" description="Coffee and pastry" fiat-currency="USD" fiat-price="97250"></bk-checkout>`,
  },
  'invoice-display': {
    html: `<bk-invoice-display id="invoice-demo" qr></bk-invoice-display>`,
    js: `document.querySelector('#invoice-demo').invoice = 'lnbc2500u1p…'; // any BOLT11 invoice`,
  },
  'payment-status': {
    html: `<bk-payment-status status="confirming" confirmations="2" required-confirmations="3"></bk-payment-status>
<bk-payment-status status="underpaid" amount-received="12000" amount-due="21000"></bk-payment-status>`,
  },
  'donation-widget': {
    html: `<bk-donation-widget adapter="mock" fiat-currency="USD" fiat-price="97250"></bk-donation-widget>`,
  },
  'lightning-address-card': {
    html: `<bk-lightning-address-card address="satoshi@example.com" name="Satoshi" description="Tips keep the lights on"></bk-lightning-address-card>`,
  },
  'wallet-connect': { html: `<bk-wallet-connect show-balance></bk-wallet-connect>` },
  'balance-card': {
    html: `<bk-balance-card balance="2450000" pending="21000" fiat-currency="USD" fiat-price="97250"></bk-balance-card>`,
  },
  'transaction-list': {
    html: `<bk-transaction-list id="tx-list" interactive></bk-transaction-list>`,
    js: `document.querySelector('#tx-list').transactions = [
  { id: 'a', direction: 'incoming', amount: 21000, timestamp: Date.now() - 300000, method: 'lightning', label: 'Coffee refund' },
  { id: 'b', direction: 'outgoing', amount: 50000, fee: 420, timestamp: Date.now() - 7200000, status: 'pending', confirmations: 1 },
];`,
  },
  'transaction-item': {
    html: `<bk-transaction-item direction="incoming" amount="21000" method="lightning" label="Zap from Alice"></bk-transaction-item>`,
  },
  'confirmation-progress': {
    html: `<bk-confirmation-progress confirmations="2" required="6" show-eta></bk-confirmation-progress>`,
  },
  'fee-selector': {
    html: `<bk-fee-selector id="fees" vsize="141" fiat-currency="USD" fiat-price="97250"></bk-fee-selector>`,
    js: `// Uses mempool.space by default. For a fixed demo:
document.querySelector('#fees').fees = { fastestFee: 24, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 };`,
  },
  'utxo-list': {
    html: `<bk-utxo-list id="utxos" target="60000"></bk-utxo-list>`,
    js: `document.querySelector('#utxos').utxos = [
  { txid: 'aa…', vout: 0, value: 50000, confirmations: 120, label: 'Exchange withdrawal' },
  { txid: 'bb…', vout: 1, value: 20000, confirmations: 3 },
];`,
  },
  'mnemonic-display': {
    html: `<bk-mnemonic-display id="phrase"></bk-mnemonic-display>`,
    js: `// Property only — never an attribute. Public BIP39 test vector, never use for funds.
document.querySelector('#phrase').words = '${PHRASE}'.split(' ');`,
  },
  'mnemonic-input': { html: `<bk-mnemonic-input></bk-mnemonic-input>` },
  'backup-check': {
    html: `<bk-backup-check id="check"></bk-backup-check>`,
    js: `document.querySelector('#check').words = '${PHRASE}'.split(' ');`,
  },
};
