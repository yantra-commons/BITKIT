import { describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture, mount, settle } from '../../test/helpers.js';
import '../index.js';
import { dateGroup } from './transaction-list/transaction-list.js';
import type {
  OuBackupCheck,
  OuBalanceCard,
  OuConfirmationProgress,
  OuFeeSelector,
  OuMnemonicDisplay,
  OuMnemonicInput,
  OuTransactionItem,
  OuTransactionList,
  OuUtxoList,
  OuWalletConnect,
  TransactionData,
} from '../index.js';

const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('timeout');
    await wait(10);
  }
}

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(
  ' ',
);
const FEES = { fastestFee: 25, halfHourFee: 12, hourFee: 8, economyFee: 4, minimumFee: 1 };

describe('ou-confirmation-progress', () => {
  it('reports progress accessibly', async () => {
    const el = await fixture<OuConfirmationProgress>(
      '<ou-confirmation-progress confirmations="2" required="6" show-eta></ou-confirmation-progress>',
    );
    const p = $(el, '[role=progressbar]');
    expect(p.getAttribute('aria-valuenow')).toBe('2');
    expect(p.getAttribute('aria-valuetext')).toBe('2 of 6 confirmations');
    expect(text(el, '.eta')).toBe('· ~40 min');
    await expectAccessible(el);
    el.confirmations = 9;
    await el.updateComplete;
    expect(text(el, '[part=label]')).toBe('Confirmed');
  });
});

describe('ou-balance-card', () => {
  it('shows balance, fiat and pending, and respects privacy', async () => {
    const el = await fixture<OuBalanceCard>(
      '<ou-balance-card balance="1234567" pending="5000" fiat-currency="USD" fiat-price="60000"></ou-balance-card>',
    );
    await settle(el);
    const amount = el.shadowRoot!.querySelector('ou-amount-display')!;
    expect(text(amount, '.value')).toBe('1,234,567 sats');
    expect(text(amount, '.fiat')).toContain('$740.74');
    expect(text(el, '.pending')).toBe('Incoming: 5,000 sats (unconfirmed)');
    await expectAccessible(el);
    $<HTMLButtonElement>(amount, '.eye').click();
    await settle(el);
    expect(el.privacy).toBe(true);
    expect($(el, '.pending')).toBeNull();
  });
});

describe('ou-transaction-item / ou-transaction-list', () => {
  const now = Date.now();
  const txs: TransactionData[] = [
    {
      id: 'a',
      direction: 'incoming',
      amount: 21000,
      timestamp: now - 60_000,
      method: 'lightning',
      label: 'Coffee refund',
    },
    {
      id: 'b',
      direction: 'outgoing',
      amount: 50000n,
      fee: 420,
      timestamp: now - 3_600_000,
      status: 'pending',
      confirmations: 1,
      txid: 'ab'.repeat(32),
    },
    {
      id: 'c',
      direction: 'outgoing',
      amount: '1000',
      timestamp: now - 86_400_000 * 3,
      status: 'failed',
    },
  ];

  it('renders an item with signed amount, method and status', async () => {
    const el = await fixture<OuTransactionItem>(
      '<ou-transaction-item explorer></ou-transaction-item>',
    );
    el.data = txs[1]!;
    await settle(el);
    expect(text(el, '.label')).toBe('Sent');
    const amount = el.shadowRoot!.querySelector('ou-amount-display')!;
    expect(text(amount, '.value')).toBe('-50,000 sats');
    expect(text(el, '.fee')).toBe('Fee 420 sats');
    expect($(el, 'ou-confirmation-progress')).not.toBeNull();
    expect($<HTMLAnchorElement>(el, 'a').href).toContain('mempool.space/tx/abab');
    await expectAccessible(el);
    el.interactive = true;
    await settle(el);
    expect($(el, 'a')).toBeNull();
    const spy = vi.fn();
    el.addEventListener('ou-select', spy);
    $<HTMLButtonElement>(el, 'button.tx').click();
    expect(spy.mock.calls[0]![0].detail).toEqual({ id: 'b' });
    await expectAccessible(el);
  });

  it('groups by date and supports empty, loading and load-more', async () => {
    const el = await fixture<OuTransactionList>(
      '<ou-transaction-list has-more></ou-transaction-list>',
    );
    expect(text(el, '.empty')).toBe('No transactions yet');
    el.loading = true;
    await el.updateComplete;
    expect($(el, '[aria-busy=true]')).not.toBeNull();
    el.loading = false;
    el.transactions = txs;
    await settle(el);
    const heads = [...el.shadowRoot!.querySelectorAll('h3')].map((h) => h.textContent);
    expect(heads[0]).toBe('Today');
    expect(heads).toHaveLength(
      txs.length - (dateGroup(txs[1]!.timestamp, 'en-US') === 'Today' ? 1 : 0),
    );
    expect(el.shadowRoot!.querySelectorAll('ou-transaction-item')).toHaveLength(3);
    const spy = vi.fn();
    el.addEventListener('ou-load-more', spy);
    ($(el.shadowRoot!.querySelector('.more ou-button')!, 'button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
    await expectAccessible(el);
  });

  it('labels date groups', () => {
    const now = new Date(2026, 4, 10, 12).getTime();
    expect(dateGroup(now - 3_600_000, 'en-US', now)).toBe('Today');
    expect(dateGroup(now - 86_400_000, 'en-US', now)).toBe('Yesterday');
    expect(dateGroup(new Date(2026, 0, 2).getTime(), 'en-US', now)).toBe('January 2');
    expect(dateGroup(new Date(2024, 0, 2).getTime(), 'en-US', now)).toBe('January 2, 2024');
    expect(dateGroup(undefined, 'en-US', now)).toBe('Pending');
  });
});

describe('ou-fee-selector', () => {
  it('shows tiers with totals and emits selections', async () => {
    const spy = vi.fn();
    document.addEventListener('ou-change', spy);
    const el = await mount<OuFeeSelector>(
      'ou-fee-selector',
      { fees: FEES, vsize: 141 },
      { 'fiat-currency': 'USD', 'fiat-price': '60000' },
    );
    document.removeEventListener('ou-change', spy);
    el.addEventListener('ou-change', spy);
    const opts = el.shadowRoot!.querySelectorAll('label.opt');
    expect(opts).toHaveLength(4);
    expect(opts[0]!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Fast ~10 min · 25 sat/vB 3,525 sats ≈ $2.12',
    );
    expect(spy.mock.calls.at(-1)![0].detail).toEqual({
      tier: 'normal',
      satPerVb: '12',
      feeSats: 1692n,
    });
    (opts[2]!.querySelector('input') as HTMLInputElement).dispatchEvent(new Event('change'));
    await settle(el);
    expect(spy.mock.calls.at(-1)![0].detail.tier).toBe('slow');
    await expectAccessible(el);
  });

  it('validates custom rates', async () => {
    const el = await mount<OuFeeSelector>('ou-fee-selector', { fees: FEES, vsize: 200 });
    (el.shadowRoot!.querySelectorAll('label.opt input')[3] as HTMLInputElement).dispatchEvent(
      new Event('change'),
    );
    await settle(el);
    const input = $<HTMLInputElement>(el, '.custom input');
    input.value = '0.5';
    input.dispatchEvent(new Event('input'));
    await settle(el);
    expect(text(el, '.warn')).toContain('too low');
    expect(el.selection).toBeUndefined();
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    await settle(el);
    expect(text(el, '.warn')).toContain('much higher');
    expect(el.selection).toEqual({ tier: 'custom', satPerVb: '100', feeSats: 20000n });
  });

  it('loads from a source and retries on error', async () => {
    let fail = true;
    const source = {
      getRecommendedFees: vi.fn(async () => (fail ? Promise.reject(new Error('x')) : FEES)),
    };
    const el = await mount<OuFeeSelector>('ou-fee-selector', { source });
    await until(() => !!el.shadowRoot!.querySelector('[role=alert]'));
    fail = false;
    ($(el.shadowRoot!.querySelector('ou-button')!, 'button') as HTMLButtonElement).click();
    await until(() => el.shadowRoot!.querySelectorAll('label.opt').length === 4);
    expect(source.getRecommendedFees).toHaveBeenCalledTimes(2);
  });
});

describe('ou-utxo-list', () => {
  const utxos = [
    { txid: 'aa'.repeat(32), vout: 0, value: 50000, confirmations: 10, label: 'Salary' },
    { txid: 'bb'.repeat(32), vout: 1, value: 20000n, confirmations: 2 },
    { txid: 'cc'.repeat(32), vout: 0, value: '5000', confirmations: 100, frozen: true },
  ];

  it('selects coins and compares against a target', async () => {
    const el = await fixture<OuUtxoList>('<ou-utxo-list target="60000"></ou-utxo-list>');
    el.utxos = utxos;
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('ou-change', spy);
    const boxes = el.shadowRoot!.querySelectorAll<HTMLInputElement>('tbody input');
    expect(boxes[2]!.disabled).toBe(true);
    boxes[0]!.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(text(el, '[part=summary]')).toBe('1 selected · 50,000 sats · 10,000 sats short');
    ($(el, '.links button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(spy.mock.calls.at(-1)![0].detail.total).toBe(70000n);
    expect(text(el, '[part=summary]')).toContain('covers the amount');
    await expectAccessible(el);
  });

  it('sorts by column', async () => {
    const el = await fixture<OuUtxoList>('<ou-utxo-list></ou-utxo-list>');
    el.utxos = utxos;
    await el.updateComplete;
    const first = () => el.shadowRoot!.querySelector('tbody tr td.num:last-child')!.textContent;
    expect(first()).toBe('50,000 sats');
    ($(el, 'th[aria-sort] button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.sortBy).toBe('confirmations');
    expect(first()).toBe('5,000 sats');
    expect($(el, 'th[aria-sort=descending]')).not.toBeNull();
  });
});

describe('ou-wallet-connect', () => {
  const NWC = `nostr+walletconnect://${'a'.repeat(64)}?relay=wss://relay.example&secret=${'b'.repeat(64)}`;

  it('connects with NWC without keeping the secret in the DOM', async () => {
    const el = await fixture<OuWalletConnect>('<ou-wallet-connect></ou-wallet-connect>');
    ($(el.shadowRoot!.querySelector('ou-button')!, 'button') as HTMLButtonElement).click();
    await settle(el);
    const input = $<HTMLInputElement>(el, 'input');
    expect(input.type).toBe('password');
    const spy = vi.fn();
    el.addEventListener('ou-connect', spy);
    input.value = 'nostr+walletconnect://bad';
    $(el, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    await el.updateComplete;
    expect(text(el, '.err')).toContain('wallet key');
    input.value = NWC;
    $(el, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(el);
    expect(input.value).toBe('');
    expect(spy.mock.calls[0]![0].detail).toMatchObject({
      type: 'nwc',
      uri: NWC,
      relays: ['wss://relay.example'],
    });
    expect(el.connected).toBe(true);
    expect(el.shadowRoot!.innerHTML).not.toContain('b'.repeat(64));
    el.disconnect();
    await el.updateComplete;
    expect(el.connected).toBe(false);
  });

  it('connects via WebLN and shows alias and balance', async () => {
    vi.stubGlobal('webln', {
      enable: vi.fn(async () => {}),
      getInfo: async () => ({ node: { alias: 'Alby' } }),
      getBalance: async () => ({ balance: 4200 }),
    });
    try {
      const el = await fixture<OuWalletConnect>(
        '<ou-wallet-connect show-balance></ou-wallet-connect>',
      );
      ($(el.shadowRoot!.querySelector('ou-button')!, 'button') as HTMLButtonElement).click();
      await settle(el);
      await expectAccessible(el);
      ($(el, 'button.opt') as HTMLButtonElement).click();
      await until(() => el.connected);
      await settle(el);
      expect(text(el, '.name')).toBe('Alby');
      expect(text(el.shadowRoot!.querySelector('ou-amount-display')!, '.value')).toBe('4,200 sats');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('delegates to Bitcoin Connect when provided', async () => {
    let cb: ((p: object) => void) | undefined;
    const bc = {
      launchModal: vi.fn(),
      onConnected: vi.fn((f: (p: object) => void) => ((cb = f), () => {})),
      disconnect: vi.fn(),
    };
    const el = await fixture<OuWalletConnect>('<ou-wallet-connect></ou-wallet-connect>');
    el.bitcoinConnect = bc;
    ($(el.shadowRoot!.querySelector('ou-button')!, 'button') as HTMLButtonElement).click();
    expect(bc.launchModal).toHaveBeenCalled();
    cb!({ enable: async () => {} });
    await until(() => el.connected);
    el.disconnect();
    expect(bc.disconnect).toHaveBeenCalled();
  });
});

describe('ou-mnemonic-display (security)', () => {
  it('does not render words until revealed and never as attributes', async () => {
    const el = await fixture<OuMnemonicDisplay>('<ou-mnemonic-display></ou-mnemonic-display>');
    el.words = [...PHRASE];
    await settle(el);
    expect(el.shadowRoot!.innerHTML).not.toContain('sausage');
    expect(el.outerHTML).not.toContain('sausage');
    expect(text(el, '.warning')).toContain('Anyone with these words can take your bitcoin');
    await expectAccessible(el);
    const reveal = vi.fn();
    el.addEventListener('ou-reveal', reveal);
    el.reveal();
    await el.updateComplete;
    expect(text(el, 'ol')).toContain('sausage');
    expect(reveal).toHaveBeenCalled();
    expect(el.outerHTML).not.toContain('sausage');
    await expectAccessible(el);
  });

  it('blocks copying and hides when the page is hidden', async () => {
    const el = await fixture<OuMnemonicDisplay>('<ou-mnemonic-display></ou-mnemonic-display>');
    el.words = [...PHRASE];
    el.reveal();
    await el.updateComplete;
    const copy = new Event('copy', { cancelable: true, bubbles: true });
    $(el, 'ol').dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(true);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await el.updateComplete;
    expect(el.revealed).toBe(false);
    expect(el.shadowRoot!.innerHTML).not.toContain('sausage');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('auto-hides and clears', async () => {
    vi.useFakeTimers();
    try {
      const el = await fixture<OuMnemonicDisplay>(
        '<ou-mnemonic-display auto-hide-ms="1000"></ou-mnemonic-display>',
      );
      const words = [...PHRASE];
      el.words = words;
      el.reveal();
      vi.advanceTimersByTime(1100);
      expect(el.revealed).toBe(false);
      el.clear();
      expect(el.words).toEqual([]);
      expect(words.every((w) => w === '')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

async function typeWord(el: OuMnemonicInput, i: number, value: string) {
  const input = el.shadowRoot!.querySelectorAll('input')[i]!;
  input.dispatchEvent(new FocusEvent('focus'));
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  return input;
}

describe('ou-mnemonic-input (security)', () => {
  it('distributes a pasted phrase, validates the checksum and never emits words', async () => {
    const el = await fixture<OuMnemonicInput>('<ou-mnemonic-input></ou-mnemonic-input>');
    const spy = vi.fn();
    el.addEventListener('ou-change', spy);
    expect(el.shadowRoot!.querySelectorAll('input')).toHaveLength(12);
    const input = el.shadowRoot!.querySelector('input')!;
    for (const attr of ['autocomplete', 'autocorrect', 'autocapitalize', 'spellcheck'])
      expect(input.hasAttribute(attr)).toBe(true);
    expect(input.getAttribute('autocomplete')).toBe('off');
    await typeWord(el, 0, PHRASE.join(' '));
    await settle(el);
    expect(el.getMnemonic()).toBe(PHRASE.join(' '));
    const detail = spy.mock.calls.at(-1)![0].detail;
    expect(detail).toEqual({ valid: true, complete: true, wordCount: 12, invalidWordIndices: [] });
    expect(JSON.stringify(spy.mock.calls.map((c) => c[0].detail))).not.toContain('sausage');
    expect(text(el, '.status')).toBe('Valid recovery phrase');
    await expectAccessible(el);
    el.clear();
    await el.updateComplete;
    expect(el.getMnemonic()).toBeNull();
    expect([...el.shadowRoot!.querySelectorAll('input')].every((i) => i.value === '')).toBe(true);
  });

  it('suggests words with an accessible combobox and flags bad words', async () => {
    const el = await fixture<OuMnemonicInput>('<ou-mnemonic-input></ou-mnemonic-input>');
    const input = await typeWord(el, 0, 'sau');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const opts = el.shadowRoot!.querySelectorAll('[role=option]');
    expect([...opts].map((o) => o.textContent!.trim())).toContain('sausage');
    expect([...opts].map((o) => o.textContent!.trim())).toEqual(['sauce', 'sausage']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await el.updateComplete;
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-1$/);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('input')[0]!.value).toBe('sausage');
    await typeWord(el, 1, 'qwerty');
    el.shadowRoot!.querySelectorAll('input')[1]!.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(text(el, '.status')).toBe('Word 2 is not in the word list.');
    expect(el.shadowRoot!.querySelectorAll('input')[1]!.getAttribute('aria-invalid')).toBe('true');
  });

  it('detects bad checksums and switches length', async () => {
    const el = await fixture<OuMnemonicInput>('<ou-mnemonic-input></ou-mnemonic-input>');
    await typeWord(el, 0, Array(12).fill('abandon').join(' '));
    await settle(el);
    expect(text(el, '.status')).toContain('phrase is not');
    const sel = $<HTMLSelectElement>(el, 'select');
    sel.value = '24';
    sel.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('input')).toHaveLength(24);
  });
});

describe('ou-backup-check (security)', () => {
  it('asks for random words and verifies', async () => {
    let n = 0;
    const el = await fixture<OuBackupCheck>('<ou-backup-check count="2"></ou-backup-check>');
    el.random = (max) => n++ % max;
    el.words = [...PHRASE];
    await el.updateComplete;
    const verified = vi.fn();
    const fail = vi.fn();
    el.addEventListener('ou-verified', verified);
    el.addEventListener('ou-fail', fail);
    expect(text(el, 'h3')).toBe('Which is word #1?');
    await expectAccessible(el);
    const choose = async (correct: boolean, idx: number) => {
      const btn = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.choice')].find(
        (b) => (b.textContent === PHRASE[idx]) === correct,
      )!;
      btn.click();
      await el.updateComplete;
    };
    await choose(false, 0);
    expect(fail.mock.calls[0]![0].detail).toEqual({ position: 1 });
    expect(text(el, '.msg')).toContain("That's not right");
    await choose(true, 0);
    expect(text(el, 'h3')).toBe('Which is word #2?');
    await choose(true, 1);
    expect(verified).toHaveBeenCalled();
    expect(text(el, 'h3')).toBe('Backup verified');
    expect(JSON.stringify(fail.mock.calls.map((c) => c[0].detail))).not.toContain('winner');
  });
});
