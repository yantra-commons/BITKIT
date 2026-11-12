import { toSats } from '@orange-ui/core';
import {
  AdapterError,
  isTerminalStatus,
  type PaymentUpdate,
  type SubscribeOptions,
  type Unsubscribe,
} from './types.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

/** True when running in a browser-like environment (where secrets must not live). */
export const isBrowser = () =>
  typeof (globalThis as { document?: unknown }).document !== 'undefined';

/**
 * Refuse to run with a secret API key in the browser. Point the adapter at your own server-side
 * proxy instead (see docs: "Server proxy pattern").
 */
export function assertNoBrowserSecret(
  adapter: string,
  secret: string | undefined,
  allow?: boolean,
): void {
  if (secret && isBrowser() && !allow) {
    throw new AdapterError(
      adapter,
      `${adapter}: API keys must never be shipped to the browser. Use a server-side proxy (baseUrl) instead.`,
    );
  }
}

export async function requestJson<T>(
  adapter: string,
  fetchFn: FetchLike,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AdapterError(adapter, `${adapter}: network error`, undefined, { cause: e });
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new AdapterError(
      adapter,
      `${adapter}: request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Parse provider amounts (number of sats or string) to bigint sats. */
export function parseSats(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' || typeof v === 'string')
    return toSats(typeof v === 'number' ? Math.round(v) : v.split('.')[0]!);
  return 0n;
}

/** Strip a trailing slash from a base URL. */
export const trimUrl = (u: string) => u.replace(/\/+$/, '');

/**
 * Generic polling subscription: calls `getStatus` every `intervalMs`, reports changes, stops at
 * terminal statuses, on abort, or on unsubscribe. Transient errors are retried with backoff.
 */
export function pollStatus(
  getStatus: (signal: AbortSignal) => Promise<PaymentUpdate>,
  onUpdate: (u: PaymentUpdate) => void,
  opts: SubscribeOptions = {},
): Unsubscribe {
  const interval = opts.intervalMs ?? 3000;
  const ctrl = new AbortController();
  opts.signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = '';
  let failures = 0;
  const tick = async () => {
    if (ctrl.signal.aborted) return;
    try {
      const u = await getStatus(ctrl.signal);
      failures = 0;
      const key = `${u.status}:${u.confirmations ?? ''}:${u.amountReceivedSats ?? ''}`;
      if (key !== last) {
        last = key;
        onUpdate(u);
      }
      if (isTerminalStatus(u.status)) return;
    } catch {
      if (ctrl.signal.aborted) return;
      failures++;
    }
    timer = setTimeout(() => void tick(), interval * Math.min(2 ** failures, 8));
  };
  void tick();
  return () => {
    ctrl.abort();
    clearTimeout(timer);
  };
}

/** Wrap an async getter with a TTL cache keyed by argument. Concurrent calls share a request. */
export function cached<A extends string, T>(
  fn: (arg: A) => Promise<T>,
  ttlMs: number,
  now = () => Date.now(),
) {
  const store = new Map<A, { at: number; value: Promise<T> }>();
  return (arg: A): Promise<T> => {
    const hit = store.get(arg);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = fn(arg).catch((e) => {
      store.delete(arg);
      throw e;
    });
    store.set(arg, { at: now(), value });
    return value;
  };
}
