/**
 * @orange-ui/elements — importing this module registers every component.
 * For smaller bundles import individual components: `import '@orange-ui/elements/amount-input'`.
 */
export { configure, getConfig, type KitConfig } from './internal/config.js';
export { DEFAULT_STRINGS, type Strings } from './internal/strings.js';
export { OrangeElement, injectTokens } from './internal/base.js';
export { define } from './internal/define.js';
export { registerAdapter, resolveAdapter } from './internal/adapters.js';

export * from './components/address-display/index.js';
export * from './components/address-input/index.js';
export * from './components/amount-display/index.js';
export * from './components/amount-input/index.js';
export * from './components/backup-check/index.js';
export * from './components/badge/index.js';
export * from './components/balance-card/index.js';
export * from './components/button/index.js';
export * from './components/checkout/index.js';
export * from './components/confirmation-progress/index.js';
export * from './components/copy-button/index.js';
export * from './components/dialog/index.js';
export * from './components/donation-widget/index.js';
export * from './components/fee-selector/index.js';
export * from './components/icon/index.js';
export * from './components/icon-button/index.js';
export * from './components/input/index.js';
export * from './components/invoice-display/index.js';
export * from './components/lightning-address-card/index.js';
export * from './components/mnemonic-display/index.js';
export * from './components/mnemonic-input/index.js';
export * from './components/network-badge/index.js';
export * from './components/pay-button/index.js';
export * from './components/payment-status/index.js';
export * from './components/qr-code/index.js';
export * from './components/qr-scanner/index.js';
export * from './components/select/index.js';
export * from './components/skeleton/index.js';
export * from './components/spinner/index.js';
export * from './components/tabs/index.js';
export * from './components/toast/index.js';
export * from './components/tooltip/index.js';
export * from './components/transaction-item/index.js';
export * from './components/transaction-list/index.js';
export * from './components/utxo-list/index.js';
export * from './components/wallet-connect/index.js';
