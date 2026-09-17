import { createHash } from 'node:crypto';
import { redis } from './feed.mjs';

export const SYMBOLS = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'EUR/GBP', 'EUR/JPY'];
export const REFRESH_MS = 20 * 60 * 1000;
export const MAX_AGE_MS = 30 * 60 * 1000;
export const DAILY_BUDGET = 768;
export const QUOTE_INTERVAL = '1min';
// Redis time and a single atomic reservation protect concurrent serverless instances.
// The cooldown is retained after failures: errors must never create retry storms.
export const RESERVE = `
local now = tonumber(redis.call('TIME')[1])
local day = math.floor(now / 86400)
local budgetKey = KEYS[2] .. ':' .. day
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local used = tonumber(redis.call('GET', budgetKey) or '0')
if used + 8 > tonumber(ARGV[1]) then return -1 end
redis.call('SET', KEYS[1], '1', 'EX', 1200)
redis.call('INCRBY', budgetKey, 8)
redis.call('EXPIRE', budgetKey, 172800)
return 1`;

export function normalizeQuotes(body, now = Date.now()) {
  return SYMBOLS.map(symbol => {
    const raw = body?.[symbol];
    const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) ? Number(value) : NaN;
    const price = number(raw?.close), change = number(raw?.percent_change), timestamp = number(raw?.timestamp) * 1000;
    if (!raw || raw.status === 'error' || raw.symbol !== symbol || !Number.isFinite(price) || price <= 0 ||
        !Number.isFinite(change) || change <= -100 || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 60000) {
      return { symbol, status: 'unavailable', price: null, change: null, asOf: null };
    }
    return { symbol, price, change, asOf: new Date(timestamp).toISOString(), status: 'available' };
  });
}

export function strengths(quotes) {
  const calculate = entries => {
    const values = entries.map(([symbol, inverse]) => {
      const q = quotes.find(q => q.symbol === symbol && q.status === 'fresh');
      return q ? (inverse ? (1 / (1 + q.change / 100) - 1) * 100 : q.change) : null;
    });
    if (values.some(v => v === null)) return null;
    // Directional breadth: positive=1, unchanged=0.5, negative=0. Equal weights.
    return { score: Math.round(100 * values.reduce((sum, v) => sum + (v > 0 ? 1 : v < 0 ? 0 : 0.5), 0) / values.length),
      meanChange: values.reduce((sum, v) => sum + v, 0) / values.length, count: values.length };
  };
  return {
    USD: calculate([['EUR/USD', true], ['GBP/USD', true], ['AUD/USD', true], ['USD/JPY', false], ['USD/CHF', false], ['USD/CAD', false]]),
    EUR: calculate([['EUR/USD', false], ['EUR/GBP', false], ['EUR/JPY', false]]),
  };
}

export function present(snapshot, now = Date.now(), reason = null) {
  const quotes = (snapshot?.quotes || normalizeQuotes(null)).map(q => ({ ...q,
    status: q.price === null ? 'unavailable' : (now - Date.parse(q.asOf) > MAX_AGE_MS || now - Date.parse(snapshot.fetchedAt) > MAX_AGE_MS) ? 'stale' : 'fresh',
  }));
  return { source: 'Twelve Data', status: quotes.every(q => q.status === 'fresh') ? 'fresh' : quotes.some(q => q.price !== null) ? 'partial_or_stale' : 'unavailable',
    fetchedAt: snapshot?.fetchedAt || null, refreshSeconds: REFRESH_MS / 1000, reason,
    quotes, strengths: strengths(quotes) };
}

export async function marketContext({ apiKey = process.env.TWELVE_DATA_API_KEY, storage = redis, fetcher = fetch, now = Date.now } = {}) {
  if (!apiKey) return present(null, now(), 'not_configured');
  // Shared by all deployments using this API key and Redis, independent of NinjaTrader namespace.
  const prefix = `6emc:td:v1:${createHash('sha256').update(apiKey).digest('hex').slice(0, 24)}`;
  // Change only the snapshot key. Existing deployments must retain their quota/cooldown.
  const snapshotKey = `${prefix}:snapshot:${QUOTE_INTERVAL}`;
  let snapshot;
  try {
    const stored = await storage(['GET', snapshotKey]);
    snapshot = stored ? JSON.parse(stored) : null;
    if (snapshot && now() - Date.parse(snapshot.fetchedAt) < REFRESH_MS) return present(snapshot, now());
    const reserved = await storage(['EVAL', RESERVE, 2, `${prefix}:cooldown`, `${prefix}:budget`, DAILY_BUDGET]);
    if (reserved !== 1) return present(snapshot, now(), reserved === -1 ? 'daily_budget' : 'cooldown');
  } catch {
    // Fail closed: never contact the paid provider without durable quota protection.
    return present(snapshot, now(), 'storage_unavailable');
  }
  try {
    const url = new URL('https://api.twelvedata.com/quote');
    url.searchParams.set('symbol', SYMBOLS.join(','));
    // Daily is the provider default; its timestamp is the daily candle opening.
    url.searchParams.set('interval', QUOTE_INTERVAL);
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('apikey', apiKey);
    const response = await fetcher(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Provider unavailable');
    const body = await response.json();
    if (body.status === 'error') throw Error('Provider unavailable');
    const quotes = normalizeQuotes(body, now());
    if (quotes.every(q => q.price === null)) throw Error('No valid quotes');
    const next = { fetchedAt: new Date(now()).toISOString(), quotes };
    await storage(['SET', snapshotKey, JSON.stringify(next), 'EX', 604800]);
    return present(next, now());
  } catch {
    return present(snapshot, now(), 'provider_or_cache_unavailable');
  }
}
