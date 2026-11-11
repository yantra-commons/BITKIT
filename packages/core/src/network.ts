export type Network = 'mainnet' | 'testnet' | 'testnet4' | 'signet' | 'regtest';

export const NETWORKS: readonly Network[] = ['mainnet', 'testnet', 'testnet4', 'signet', 'regtest'];

export const isNetwork = (v: unknown): v is Network => NETWORKS.includes(v as Network);

/** Human-readable network names. */
export const NETWORK_LABELS: Readonly<Record<Network, string>> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  testnet4: 'Testnet4',
  signet: 'Signet',
  regtest: 'Regtest',
};

/** bech32 human-readable part for segwit addresses. */
export const BECH32_HRP: Readonly<Record<Network, string>> = {
  mainnet: 'bc',
  testnet: 'tb',
  testnet4: 'tb',
  signet: 'tb',
  regtest: 'bcrt',
};

/** base58check version bytes. */
export const BASE58_VERSIONS: Readonly<Record<'main' | 'test', { p2pkh: number; p2sh: number }>> = {
  main: { p2pkh: 0x00, p2sh: 0x05 },
  test: { p2pkh: 0x6f, p2sh: 0xc4 },
};

/** Networks that share address formats with `network` (testnet/testnet4/signet are indistinguishable). */
export function compatibleNetworks(network: Network): Network[] {
  if (network === 'mainnet') return ['mainnet'];
  if (network === 'regtest') return ['regtest'];
  return ['testnet', 'testnet4', 'signet'];
}

export type ExplorerKind = 'address' | 'tx' | 'block';

const MEMPOOL_PATH: Readonly<Record<Network, string | null>> = {
  mainnet: '',
  testnet: '/testnet',
  testnet4: '/testnet4',
  signet: '/signet',
  regtest: null,
};

/**
 * Block explorer URL. Defaults to mempool.space; pass `baseUrl` for a self-hosted instance
 * (e.g. "https://mempool.example.org"). Returns null for regtest without a base URL.
 */
export function explorerUrl(
  kind: ExplorerKind,
  id: string,
  network: Network = 'mainnet',
  baseUrl?: string,
): string | null {
  const path = MEMPOOL_PATH[network];
  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}/${kind}/${encodeURIComponent(id)}`;
  if (path === null) return null;
  return `https://mempool.space${path}/${kind}/${encodeURIComponent(id)}`;
}
