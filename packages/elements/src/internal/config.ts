import type { DisplayUnit, FiatRate, Network } from '@bitkit-ui/core';
import { DEFAULT_STRINGS, type Strings } from './strings.js';

/** Global defaults shared by all components. Per-element attributes always win. */
export interface KitConfig {
  /** BCP 47 locale for number formatting. Default: document language or 'en-US'. */
  locale?: string;
  /** Network components validate and display against. Default 'mainnet'. */
  network: Network;
  /** Default amount display unit. Default 'sats'. */
  unit: DisplayUnit;
  /** Optional default fiat rate for fiat previews. */
  fiatRate?: FiatRate;
  /** Explorer base URL (mempool.space compatible). Default: mempool.space per network. */
  explorerBaseUrl?: string;
  /** UI strings; override for localisation. */
  strings: Strings;
  /** Inject token CSS into the document automatically. Default true. */
  injectTokens: boolean;
}

const state: KitConfig = {
  network: 'mainnet',
  unit: 'sats',
  strings: DEFAULT_STRINGS,
  injectTokens: true,
};

export const CONFIG_EVENT = 'bk-config-change';

/** Read the current global config. */
export const getConfig = (): Readonly<KitConfig> => state;

/**
 * Update global defaults, e.g. `configure({ network: 'signet', locale: 'de-DE' })`.
 * Mounted components re-render automatically.
 */
export function configure(
  patch: Partial<Omit<KitConfig, 'strings'>> & { strings?: Partial<Strings> },
): void {
  const { strings, ...rest } = patch;
  Object.assign(state, rest);
  if (strings) state.strings = { ...state.strings, ...strings };
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent(CONFIG_EVENT));
  }
}

/** Resolve a locale: explicit > config > <html lang> > en-US. */
export function resolveLocale(explicit?: string): string {
  if (explicit) return explicit;
  if (state.locale) return state.locale;
  if (typeof document !== 'undefined' && document.documentElement.lang)
    return document.documentElement.lang;
  return 'en-US';
}
