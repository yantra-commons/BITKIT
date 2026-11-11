/**
 * Default English UI copy, following Bitcoin Design Guide terminology. Override any key with
 * `configure({ strings: { copy: 'Kopieren' } })`. `{name}` placeholders are interpolated.
 */
export const DEFAULT_STRINGS = {
  loading: 'Loading',
  copy: 'Copy',
  copied: 'Copied',
  copiedAnnouncement: 'Copied to clipboard',
  copyFailed: 'Could not copy. Select the text and copy it manually.',
  close: 'Close',
  dismiss: 'Dismiss',
  paste: 'Paste',
  scan: 'Scan QR code',
  clear: 'Clear',
  showQr: 'Show QR code',
  hideQr: 'Hide QR code',
  qrCodeFor: 'QR code for {label}',
  viewOnExplorer: 'View on block explorer',
  showFullAddress: 'Show full address',
  bitcoinAddress: 'Bitcoin address',
  invalidAddress: 'Invalid address',
  changeUnit: 'Change unit',
  amountHidden: 'Amount hidden',
  showAmount: 'Show amount',
  hideAmount: 'Hide amount',
  amount: 'Amount',
  max: 'Max',
  available: 'Available: {amount}',
  minimumIs: 'The minimum is {amount}.',
  maximumIs: 'The maximum is {amount}.',
  notEnoughFunds: 'Not enough funds. Available: {amount}.',
  enterValidAmount: 'Enter a valid amount.',
  unit: 'Unit',
  recipient: 'Recipient',
  recipientPlaceholder: 'Address, invoice or Lightning Address',
  cameraStarting: 'Starting camera…',
  cameraDenied: 'Camera access was denied. You can paste or upload an image instead.',
  cameraUnavailable: 'No camera is available on this device.',
  scannerUnsupported:
    'QR scanning is not supported in this browser. Paste the code or upload a picture of it.',
  scannerHint: 'Point your camera at a QR code',
  uploadImage: 'Upload image',
  noQrFound: 'No QR code was found in that image.',
  networkMainnet: 'Mainnet',
  networkTestnet: 'Testnet',
  networkTestnet4: 'Testnet4',
  networkSignet: 'Signet',
  networkRegtest: 'Regtest',
};

export type Strings = typeof DEFAULT_STRINGS;
export type StringKey = keyof Strings;

export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
