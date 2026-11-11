import type { ComplexAttributeConverter } from 'lit';

/** Attribute <-> bigint converter. Invalid attribute values become undefined. */
export const bigintConverter: ComplexAttributeConverter<bigint | undefined> = {
  fromAttribute(value: string | null): bigint | undefined {
    if (value === null || value.trim() === '') return undefined;
    try {
      return BigInt(value.trim());
    } catch {
      return undefined;
    }
  },
  toAttribute(value: bigint | undefined): string | null {
    return value === undefined || value === null ? null : value.toString();
  },
};

/** Coerce a property value that may arrive as bigint, number or string to bigint. */
export function toBigint(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : undefined;
  if (typeof value === 'string') return bigintConverter.fromAttribute!(value) as bigint | undefined;
  return undefined;
}

/** Comma/space separated list attribute <-> string[]. */
export const listConverter: ComplexAttributeConverter<string[]> = {
  fromAttribute: (v: string | null) => (v ? v.split(/[\s,]+/).filter(Boolean) : []),
  toAttribute: (v: string[]) => v.join(','),
};
