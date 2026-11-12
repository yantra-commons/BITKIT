// Minimal payment proxy: the browser talks to this server with HttpAdapter; this server holds
// the provider API key and talks to BTCPay Server. No secrets ever reach the browser.
//
//   BTCPAY_URL=https://btcpay.example.com BTCPAY_STORE_ID=… BTCPAY_API_KEY=… \
//   ALLOWED_ORIGIN=https://shop.example.com node src/server.mjs
//
// Without BTCPAY_* variables it falls back to the mock adapter so the example runs anywhere.
//
// Browser side:
//   import { createHttpAdapter } from '@orange-ui/adapters/http';
//   checkout.adapter = createHttpAdapter({ baseUrl: 'http://localhost:8787/api/payments' });
import { createServer } from 'node:http';
import { BtcPayAdapter } from '@orange-ui/adapters/btcpay';
import { MockAdapter } from '@orange-ui/adapters/mock';
import { isSafeId, rateLimiter, toJson, validateCreate } from './handlers.mjs';

const {
  BTCPAY_URL,
  BTCPAY_STORE_ID,
  BTCPAY_API_KEY,
  ALLOWED_ORIGIN = 'http://localhost:5173',
  PORT = '8787',
} = process.env;

const adapter =
  BTCPAY_URL && BTCPAY_STORE_ID && BTCPAY_API_KEY
    ? new BtcPayAdapter({ baseUrl: BTCPAY_URL, storeId: BTCPAY_STORE_ID, apiKey: BTCPAY_API_KEY })
    : new MockAdapter({ scenario: 'manual' });
const allow = rateLimiter({ limit: 30, windowMs: 60_000 });

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body === undefined ? '' : toJson(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 10_000) throw new Error('Body too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'OPTIONS') return send(res, 204);
  if (!allow(req.socket.remoteAddress ?? 'unknown'))
    return send(res, 429, { error: 'Too many requests' });
  try {
    if (req.method === 'POST' && url.pathname === '/api/payments') {
      const v = validateCreate(await readJson(req));
      if (!v.ok) return send(res, 400, { error: v.error });
      return send(res, 201, await adapter.createInvoice(v.value));
    }
    const m = /^\/api\/payments\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'GET' && m) {
      if (!isSafeId(m[1])) return send(res, 400, { error: 'Invalid id' });
      return send(res, 200, await adapter.getStatus(m[1]));
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: 'Payment provider error' });
  }
}).listen(Number(PORT), () =>
  console.log(`payment proxy on http://localhost:${PORT} (${adapter.name})`),
);
