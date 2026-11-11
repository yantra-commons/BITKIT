import { numberToPlainString, type FiatRate, type RecommendedFees } from '@bitkit-ui/core';
import {
  AdapterError,
  type FeeRateAdapter,
  type FiatRateAdapter,
  type RequestOptions,
} from './types.js';
import { cached, defaultFetch, requestJson, trimUrl, type FetchLike } from './util.js';

export interface MempoolOptions {
  /** mempool.space-compatible API base. Default `https://mempool.space/api`. */
  baseUrl?: string;
  /** Cache lifetime. Default 60 s. */
  cacheMs?: number;
  fetch?: FetchLike;
}

/**
 * Fee estimates and BTC prices from mempool.space (or a self-hosted instance). No API key, no
 * user data is sent. Responses are cached and concurrent requests are de-duplicated.
 */
export class MempoolRates implements FiatRateAdapter, FeeRateAdapter {
  readonly #base: string;
  readonly #fees: (k: 'fees') => Promise<RecommendedFees>;
  readonly #prices: (k: 'prices') => Promise<Record<string, number>>;

  constructor(opts: MempoolOptions = {}) {
    this.#base = trimUrl(opts.baseUrl ?? 'https://mempool.space/api');
    const f = opts.fetch ?? defaultFetch;
    const ttl = opts.cacheMs ?? 60_000;
    this.#fees = cached(
      () => requestJson<RecommendedFees>('mempool', f, `${this.#base}/v1/fees/recommended`),
      ttl,
    );
    this.#prices = cached(
      () => requestJson<Record<string, number>>('mempool', f, `${this.#base}/v1/prices`),
      ttl,
    );
  }

  getRecommendedFees(_opts?: RequestOptions): Promise<RecommendedFees> {
    return this.#fees('fees');
  }

  async getRate(currency: string, _opts?: RequestOptions): Promise<FiatRate> {
    const prices = await this.#prices('prices');
    const code = currency.toUpperCase();
    const price = prices[code];
    if (typeof price !== 'number' || price <= 0) {
      throw new AdapterError('mempool', `mempool: no price for ${code}`);
    }
    return {
      currency: code,
      price: numberToPlainString(price),
      timestamp: (prices.time ?? 0) * 1000 || Date.now(),
    };
  }
}

export const createMempoolRates = (opts?: MempoolOptions) => new MempoolRates(opts);

/** Fixed rates for demos and tests. */
export function staticRates(
  prices: Record<string, string>,
  fees?: RecommendedFees,
): FiatRateAdapter & FeeRateAdapter {
  return {
    async getRate(currency) {
      const price = prices[currency.toUpperCase()];
      if (!price) throw new AdapterError('static', `static: no price for ${currency}`);
      return { currency: currency.toUpperCase(), price, timestamp: Date.now() };
    },
    async getRecommendedFees() {
      return fees ?? { fastestFee: 20, halfHourFee: 12, hourFee: 6, economyFee: 3, minimumFee: 1 };
    },
  };
}
