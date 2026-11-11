// Request validation + JSON helpers for the payment proxy. Pure functions, unit tested.

export const MAX_SATS = 10_000_000n; // refuse anything above 0.1 BTC from an anonymous browser
export const MAX_DESCRIPTION = 140;

/**
 * Validate a browser's create-invoice request. The browser only chooses *what* to buy; the
 * server decides the price in real shops (look the product up instead of trusting amountSats).
 * @returns {{ ok: true, value: { amountSats: bigint, description?: string, orderId?: string, methods?: string[] } } | { ok: false, error: string }}
 */
export function validateCreate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };
  const raw = body.amountSats;
  if (typeof raw !== 'string' && typeof raw !== 'number')
    return { ok: false, error: 'amountSats is required' };
  const s = String(raw);
  if (!/^\d{1,16}$/.test(s)) return { ok: false, error: 'amountSats must be a whole number' };
  const amountSats = BigInt(s);
  if (amountSats <= 0n || amountSats > MAX_SATS)
    return { ok: false, error: `amountSats must be between 1 and ${MAX_SATS}` };
  const description =
    body.description === undefined ? undefined : String(body.description).slice(0, MAX_DESCRIPTION);
  const orderId = body.orderId === undefined ? undefined : String(body.orderId).slice(0, 64);
  const methods = Array.isArray(body.methods)
    ? body.methods.filter((m) => m === 'lightning' || m === 'onchain')
    : undefined;
  return {
    ok: true,
    value: { amountSats, description, orderId, methods: methods?.length ? methods : undefined },
  };
}

/** Invoice ids are opaque provider ids; restrict to a safe charset before forwarding. */
export const isSafeId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);

/** JSON.stringify that encodes bigint as string (the HttpAdapter wire format). */
export const toJson = (v) =>
  JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));

/** Simple fixed-window rate limiter keyed by client address. */
export function rateLimiter({ limit = 30, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}
