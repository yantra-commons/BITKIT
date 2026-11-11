import { afterEach, describe, expect, it, vi } from 'vitest';
import { $, expectAccessible, fixture, settle } from '../../test/helpers.js';
import '../index.js';
import { configure } from '../internal/config.js';
import type { BkAddressDisplay, BkAddressInput, BkNetworkBadge, BkQrScanner } from '../index.js';

const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const TESTNET = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7';
const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim();

afterEach(() => configure({ network: 'mainnet' }));

describe('bk-network-badge', () => {
  it('labels each network and can hide mainnet', async () => {
    const el = await fixture<BkNetworkBadge>(
      '<bk-network-badge network="signet"></bk-network-badge>',
    );
    expect(text(el, '.b')).toBe('Signet');
    expect($(el, '.b').className).toContain('signet');
    await expectAccessible(el);
    el.network = 'mainnet';
    el.hideMainnet = true;
    await el.updateComplete;
    expect($(el, '.b')).toBeNull();
    configure({ network: 'regtest' });
    el.network = undefined;
    await el.updateComplete;
    expect(text(el, '.b')).toBe('Regtest');
  });
});

describe('bk-address-display', () => {
  it('chunks the address and reads it character by character', async () => {
    const el = await fixture<BkAddressDisplay>(
      `<bk-address-display address="${SEGWIT.toUpperCase()}" label="Deposit address"></bk-address-display>`,
    );
    const chunks = el.shadowRoot!.querySelectorAll('.chunk');
    expect(chunks[0]!.textContent).toBe('bc1q');
    expect(chunks).toHaveLength(Math.ceil(SEGWIT.length / 4));
    expect(text(el, '.addr .sr-only')).toMatch(/^Deposit address: b c 1 q, w 5 0 8/);
    expect(el.shadowRoot!.querySelector('bk-copy-button')!.value).toBe(SEGWIT);
    await expectAccessible(el);
  });

  it('truncates in the middle and expands on click', async () => {
    const el = await fixture<BkAddressDisplay>(
      `<bk-address-display address="${TAPROOT}" truncate="middle"></bk-address-display>`,
    );
    const btn = $<HTMLButtonElement>(el, '.expand');
    expect(btn.textContent).toContain('…');
    btn.click();
    await el.updateComplete;
    expect($(el, '.expand')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('.chunk').length).toBeGreaterThan(10);
  });

  it('toggles a QR code, shows network/type and links to the explorer', async () => {
    const el = await fixture<BkAddressDisplay>(
      `<bk-address-display address="${TESTNET}" qr explorer show-network show-type></bk-address-display>`,
    );
    expect(text(el, '.meta')).toContain('Native SegWit script (P2WSH)');
    expect(el.shadowRoot!.querySelector('bk-network-badge')!.getAttribute('network')).toBe(
      'testnet',
    );
    expect($<HTMLAnchorElement>(el, 'a.icon-btn').href).toBe(
      `https://mempool.space/testnet/address/${TESTNET}`,
    );
    const qrBtn = $<HTMLButtonElement>(el, 'button.icon-btn');
    qrBtn.click();
    await settle(el);
    expect(el.qrOpen).toBe(true);
    expect(el.shadowRoot!.querySelector('bk-qr-code')!.value).toBe(TESTNET.toUpperCase());
    expect($(el, 'button.icon-btn').getAttribute('aria-pressed')).toBe('true');
    await expectAccessible(el);
  });

  it('flags invalid addresses and handles empty', async () => {
    const el = await fixture<BkAddressDisplay>(
      '<bk-address-display address="bc1qnotvalid"></bk-address-display>',
    );
    expect(text(el, '.invalid')).toMatch(/^Invalid address/);
    el.address = '';
    await el.updateComplete;
    expect(text(el, '.empty')).toBe('—');
  });
});

async function typeInto(el: BkAddressInput, value: string) {
  const ta = $<HTMLTextAreaElement>(el, 'textarea');
  ta.value = value;
  ta.dispatchEvent(new Event('input'));
  await el.updateComplete;
  await el.updateComplete;
}

describe('bk-address-input', () => {
  it('validates as you type and describes the destination', async () => {
    const el = await fixture<BkAddressInput>('<bk-address-input></bk-address-input>');
    const spy = vi.fn();
    el.addEventListener('bk-input', spy);
    await typeInto(el, TAPROOT);
    expect(text(el, '.status')).toBe('Taproot (P2TR) · Mainnet');
    expect(el.invalid).toBe(false);
    expect(spy.mock.calls.at(-1)![0].detail).toMatchObject({ value: TAPROOT, valid: true });
    expect($(el, 'label').textContent).toContain('Recipient');
    await expectAccessible(el);
  });

  it('shows errors after blur or once the input looks complete', async () => {
    const el = await fixture<BkAddressInput>('<bk-address-input></bk-address-input>');
    await typeInto(el, 'bc1q');
    expect(el.invalid).toBe(false);
    $(el, 'textarea').dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(el.invalid).toBe(true);
    await typeInto(el, `${SEGWIT.slice(0, -1)}5`);
    expect(text(el, '.error')).toContain('typo');
    expect($(el, 'textarea').getAttribute('aria-invalid')).toBe('true');
    await expectAccessible(el);
  });

  it('enforces network and accepted types', async () => {
    const el = await fixture<BkAddressInput>(
      '<bk-address-input network="mainnet"></bk-address-input>',
    );
    await typeInto(el, TESTNET);
    expect(text(el, '.error')).toBe('This is a Testnet address, but Mainnet is expected.');
    el.network = 'testnet';
    await el.updateComplete;
    await typeInto(el, TESTNET);
    expect(el.invalid).toBe(false);
    el.accept = ['onchain-address'];
    await typeInto(el, 'alice@example.com');
    expect(el.result?.type).toBe('invalid');
    el.accept = ['lightning-address'];
    await typeInto(el, 'alice@example.com');
    expect(text(el, '.status')).toBe('Lightning Address · example.com');
  });

  it('strips newlines, clears, and pastes from the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(` ${SEGWIT}\n`) },
      configurable: true,
    });
    const el = await fixture<BkAddressInput>('<bk-address-input></bk-address-input>');
    const changes = vi.fn();
    el.addEventListener('bk-change', changes);
    ($(el, 'button.tool[aria-label=Paste]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await el.updateComplete;
    expect(el.value).toBe(SEGWIT);
    expect(changes).toHaveBeenCalled();
    ($(el, 'button.tool[aria-label=Clear]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.value).toBe('');
    await typeInto(el, `${SEGWIT}\n`);
    expect(el.value).toBe(SEGWIT);
  });

  it('opens the scanner dialog and accepts a scanned value', async () => {
    const el = await fixture<BkAddressInput>('<bk-address-input></bk-address-input>');
    ($(el, 'button.tool[aria-label="Scan QR code"]') as HTMLButtonElement).click();
    await settle(el);
    const scanner = el.shadowRoot!.querySelector('bk-qr-scanner')!;
    expect(scanner.active).toBe(true);
    scanner.dispatchEvent(
      new CustomEvent('bk-scan', { detail: { value: `bitcoin:${SEGWIT}?amount=0.001` } }),
    );
    await settle(el);
    expect(el.value).toBe(`bitcoin:${SEGWIT}?amount=0.001`);
    expect(text(el, '.status')).toBe('Payment link · 100,000 sats');
  });
});

describe('bk-qr-scanner', () => {
  it('explains when scanning is unsupported', async () => {
    const el = await fixture<BkQrScanner>('<bk-qr-scanner></bk-qr-scanner>');
    const spy = vi.fn();
    el.addEventListener('bk-error', spy);
    el.active = true;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(spy.mock.calls[0]![0].detail).toEqual({ code: 'unsupported' });
    expect(text(el, '[role=alert]')).toContain('not supported');
    await expectAccessible(el);
  });

  it('reports denied camera access and offers upload', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
      },
      configurable: true,
    });
    const el = await fixture<BkQrScanner>('<bk-qr-scanner></bk-qr-scanner>');
    el.decoder = vi.fn().mockResolvedValue(null);
    const spy = vi.fn();
    el.addEventListener('bk-error', spy);
    await el.start();
    await el.updateComplete;
    expect(spy.mock.calls[0]![0].detail).toEqual({ code: 'denied' });
    expect($(el, 'input[type=file]')).not.toBeNull();
    await expectAccessible(el);
  });

  it('decodes an uploaded image', async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi
      .fn()
      .mockResolvedValue({ close() {} });
    const el = await fixture<BkQrScanner>('<bk-qr-scanner></bk-qr-scanner>');
    el.decoder = vi.fn().mockResolvedValue(SEGWIT);
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    await el.start();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('bk-scan', spy);
    const input = $<HTMLInputElement>(el, 'input[type=file]');
    Object.defineProperty(input, 'files', { value: [new Blob(['x'])], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(spy.mock.calls[0]![0].detail.value).toBe(SEGWIT);
    expect(spy.mock.calls[0]![0].detail.result.type).toBe('onchain-address');
  });
});
