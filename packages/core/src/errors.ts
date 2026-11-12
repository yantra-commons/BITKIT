/** Machine-readable error codes produced by @orange-ui/core. */
export type ErrorCode =
  | 'empty'
  | 'invalid-number'
  | 'too-many-decimals'
  | 'negative'
  | 'out-of-range'
  | 'invalid-characters'
  | 'invalid-checksum'
  | 'invalid-length'
  | 'mixed-case'
  | 'unknown-prefix'
  | 'wrong-network'
  | 'invalid-witness-version'
  | 'invalid-program-length'
  | 'invalid-padding'
  | 'invalid-uri'
  | 'invalid-amount'
  | 'invalid-address'
  | 'unsupported-required-param'
  | 'invalid-field'
  | 'missing-field'
  | 'duplicate-field'
  | 'unknown-required-feature'
  | 'invalid-description'
  | 'invalid-lnurl'
  | 'invalid-lightning-address'
  | 'invalid-offer'
  | 'invalid-mnemonic'
  | 'unrecognized';

/** Error thrown by core parsers. `message` is safe to show to end users. */
export class OrangeError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OrangeError';
    this.code = code;
  }
}

export const isOrangeError = (e: unknown): e is OrangeError => e instanceof OrangeError;

/** Plain-object form of an error, convenient for UI state. */
export interface ErrorInfo {
  code: ErrorCode;
  message: string;
}

export const toErrorInfo = (e: unknown): ErrorInfo =>
  isOrangeError(e)
    ? { code: e.code, message: e.message }
    : { code: 'unrecognized', message: e instanceof Error ? e.message : String(e) };
