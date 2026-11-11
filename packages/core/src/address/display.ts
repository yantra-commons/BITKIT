/** Split a string into fixed-size groups for readable display (Bitcoin Design Guide). */
export function chunkString(value: string, size = 4): string[] {
  if (size < 1) return [value];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}

/** Alias kept for discoverability. */
export const chunkAddress = chunkString;

export interface TruncateOptions {
  /** Characters kept at the start. Default 8. */
  start?: number;
  /** Characters kept at the end. Default 8. */
  end?: number;
  /** Separator. Default '…'. */
  ellipsis?: string;
}

/** Middle-truncate an address or hash: "bc1qar0s…5mdq". */
export function truncateMiddle(value: string, opts: TruncateOptions = {}): string {
  const start = opts.start ?? 8;
  const end = opts.end ?? 8;
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}${opts.ellipsis ?? '…'}${value.slice(value.length - end)}`;
}

/**
 * Screen-reader friendly reading of an address: characters spaced out in groups, with
 * "capital" announced for upper-case letters when the encoding is case-sensitive (base58).
 */
export function addressForScreenReader(address: string, size = 4): string {
  const caseSensitive = !/^(bc|tb|bcrt)1/i.test(address);
  return chunkString(address, size)
    .map((chunk) =>
      [...chunk]
        .map((c) => (caseSensitive && /[A-Z]/.test(c) ? `capital ${c}` : c.toLowerCase()))
        .join(' '),
    )
    .join(', ');
}
