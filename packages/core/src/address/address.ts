import { OrangeError, toErrorInfo, type ErrorInfo } from '../errors.js';
import { base58check, bech32, bech32m, isBech32Charset, toHex } from '../encoding.js';
import {
  BASE58_VERSIONS,
  BECH32_HRP,
  compatibleNetworks,
  NETWORK_LABELS,
  type Network,
} from '../network.js';

export type AddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'witness-unknown';

export interface AddressInfo {
  /** Normalised address (bech32 lower-cased). */
  address: string;
  type: AddressType;
  encoding: 'base58' | 'bech32' | 'bech32m';
  /** Every network the address is valid on (testnet, testnet4 and signet share formats). */
  networks: Network[];
  /** Witness version for segwit addresses. */
  witnessVersion?: number;
  /** Hash / witness program as hex. */
  program: string;
}

export const ADDRESS_TYPE_LABELS: Readonly<Record<AddressType, string>> = {
  p2pkh: 'Legacy (P2PKH)',
  p2sh: 'Script (P2SH)',
  p2wpkh: 'Native SegWit (P2WPKH)',
  p2wsh: 'Native SegWit script (P2WSH)',
  p2tr: 'Taproot (P2TR)',
  'witness-unknown': 'Future SegWit version',
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

const TYPO = 'This address has a typo or is incomplete. Please check it and try again.';

function decodeSegwit(input: string): AddressInfo {
  const lower = input.toLowerCase();
  if (input !== lower && input !== input.toUpperCase()) {
    throw new OrangeError('mixed-case', 'Addresses cannot mix upper and lower case letters.');
  }
  const sep = lower.lastIndexOf('1');
  const hrp = lower.slice(0, sep);
  const data = lower.slice(sep + 1);
  const networks = (Object.keys(BECH32_HRP) as Network[]).filter((n) => BECH32_HRP[n] === hrp);
  if (!networks.length) throw new OrangeError('unknown-prefix', 'This is not a Bitcoin address.');
  if (!isBech32Charset(data)) throw new OrangeError('invalid-characters', TYPO);
  if (lower.length > 90) throw new OrangeError('invalid-length', TYPO);

  const b32 = bech32.decodeUnsafe(lower);
  const b32m = b32 ? undefined : bech32m.decodeUnsafe(lower);
  const decoded = b32 ?? b32m;
  if (!decoded) throw new OrangeError('invalid-checksum', TYPO);
  const [version, ...rest] = decoded.words;
  if (version === undefined) throw new OrangeError('invalid-length', TYPO);
  if (version > 16)
    throw new OrangeError('invalid-witness-version', 'Unsupported address version.');
  if ((version === 0 && !b32) || (version > 0 && !b32m)) {
    throw new OrangeError('invalid-checksum', TYPO);
  }
  let program: Uint8Array;
  try {
    program = bech32.fromWords(rest);
  } catch (e) {
    throw new OrangeError('invalid-padding', TYPO, { cause: e });
  }
  if (program.length < 2 || program.length > 40)
    throw new OrangeError('invalid-program-length', TYPO);
  let type: AddressType = 'witness-unknown';
  if (version === 0) {
    if (program.length === 20) type = 'p2wpkh';
    else if (program.length === 32) type = 'p2wsh';
    else throw new OrangeError('invalid-program-length', TYPO);
  } else if (version === 1 && program.length === 32) type = 'p2tr';
  return {
    address: lower,
    type,
    encoding: version === 0 ? 'bech32' : 'bech32m',
    networks,
    witnessVersion: version,
    program: toHex(program),
  };
}

function decodeBase58(input: string): AddressInfo {
  if (!BASE58_RE.test(input)) throw new OrangeError('invalid-characters', TYPO);
  let bytes: Uint8Array;
  try {
    bytes = base58check.decode(input);
  } catch (e) {
    throw new OrangeError('invalid-checksum', TYPO, { cause: e });
  }
  if (bytes.length !== 21) throw new OrangeError('invalid-length', TYPO);
  const version = bytes[0];
  const program = toHex(bytes.subarray(1));
  const main = BASE58_VERSIONS.main;
  const test = BASE58_VERSIONS.test;
  const testNets: Network[] = ['testnet', 'testnet4', 'signet', 'regtest'];
  switch (version) {
    case main.p2pkh:
      return { address: input, type: 'p2pkh', encoding: 'base58', networks: ['mainnet'], program };
    case main.p2sh:
      return { address: input, type: 'p2sh', encoding: 'base58', networks: ['mainnet'], program };
    case test.p2pkh:
      return { address: input, type: 'p2pkh', encoding: 'base58', networks: testNets, program };
    case test.p2sh:
      return { address: input, type: 'p2sh', encoding: 'base58', networks: testNets, program };
    default:
      throw new OrangeError('unknown-prefix', 'This is not a Bitcoin address.');
  }
}

/** Looks like a segwit address (has a known-looking bech32 prefix). */
const looksSegwit = (s: string) => /^(bc|tb|bcrt)1/i.test(s);

/**
 * Decode and validate a Bitcoin address. Throws `OrangeError` with a user-facing message.
 * If `network` is given, the address must be valid on that network.
 */
export function decodeAddress(input: string, network?: Network): AddressInfo {
  const s = input.trim();
  if (!s) throw new OrangeError('empty', 'Enter a Bitcoin address.');
  let info: AddressInfo;
  if (looksSegwit(s)) info = decodeSegwit(s);
  else if (s.includes('1') && /^[a-z]{1,83}1/i.test(s) && !BASE58_RE.test(s))
    info = decodeSegwit(s);
  else info = decodeBase58(s);
  if (network && !info.networks.includes(network)) {
    const actual = info.networks.includes('mainnet')
      ? 'Mainnet'
      : NETWORK_LABELS[info.networks[0]!];
    throw new OrangeError(
      'wrong-network',
      `This is a ${actual} address, but ${NETWORK_LABELS[network]} is expected.`,
    );
  }
  return info;
}

export type AddressValidation =
  { valid: true; info: AddressInfo } | { valid: false; error: ErrorInfo };

/** Non-throwing variant of `decodeAddress`. */
export function validateAddress(input: string, network?: Network): AddressValidation {
  try {
    return { valid: true, info: decodeAddress(input, network) };
  } catch (e) {
    return { valid: false, error: toErrorInfo(e) };
  }
}

export const isValidAddress = (input: string, network?: Network) =>
  validateAddress(input, network).valid;

/** Encode an address from its parts (used for BOLT11 fallback addresses and tests). */
export function encodeAddress(
  type: AddressType,
  program: Uint8Array,
  network: Network,
  witnessVersion?: number,
): string {
  if (type === 'p2pkh' || type === 'p2sh') {
    const v = BASE58_VERSIONS[network === 'mainnet' ? 'main' : 'test'][type];
    return base58check.encode(Uint8Array.from([v, ...program]));
  }
  const version = witnessVersion ?? (type === 'p2tr' ? 1 : 0);
  const words = [version, ...bech32.toWords(program)];
  const hrp = BECH32_HRP[network];
  return version === 0 ? bech32.encode(hrp, words) : bech32m.encode(hrp, words);
}

export { compatibleNetworks };
