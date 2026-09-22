export const INTERMARKET_ROOTS = ['GC', 'CL'];
export const INTERMARKET_LIVE_MS = 20_000;

const limits = { GC: [500, 15_000], CL: [0.01, 500] };
const validNumber = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function validateIntermarketSnapshot(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) throw Error('Invalid schema');
  if (!INTERMARKET_ROOTS.includes(value.root)) throw Error('Expected GC or CL');
  if (typeof value.instrument !== 'string' || !new RegExp(`^${value.root} [A-Za-z0-9 -]{2,24}$`).test(value.instrument)) throw Error('Invalid futures contract');
  const sentAt = Date.parse(value.sentAt);
  const barTime = Date.parse(value.barTimeUtc);
  if (!Number.isFinite(sentAt) || Math.abs(sentAt - now) > 60_000) throw Error('Check the Windows clock');
  if (!Number.isFinite(barTime) || barTime > sentAt + 60_000 || sentAt - barTime > 120_000) throw Error('Invalid bar timestamp');
  const [min, max] = limits[value.root];
  for (const key of ['price', 'open', 'high', 'low', 'close']) {
    if (!validNumber(value[key], min, max)) throw Error(`Invalid ${key}`);
  }
  if (value.high < Math.max(value.open, value.close, value.low) || value.low > Math.min(value.open, value.close, value.high)) throw Error('Invalid OHLC');
  return {
    schemaVersion: 1, root: value.root, instrument: value.instrument,
    price: value.price, open: value.open, high: value.high, low: value.low, close: value.close,
    sentAt: new Date(sentAt).toISOString(), barTimeUtc: new Date(barTime).toISOString(),
    receivedAt: new Date(now).toISOString(), source: 'ninjatrader_futures_chart',
    provider: 'NinjaTrader futures data', latencyMs: Math.max(0, now - sentAt),
  };
}

export function presentIntermarket(snapshot, root, now = Date.now()) {
  if (!snapshot || snapshot.root !== root || snapshot.source !== 'ninjatrader_futures_chart' ||
      typeof snapshot.price !== 'number' || !Number.isFinite(snapshot.price)) {
    return { root, status: 'unavailable', price: null, instrument: null, asOf: null };
  }
  const age = now - Date.parse(snapshot.sentAt);
  const live = Number.isFinite(age) && age >= 0 && age < INTERMARKET_LIVE_MS;
  return {
    root, status: live ? 'live' : 'stale', price: live ? snapshot.price : null,
    instrument: snapshot.instrument, asOf: snapshot.sentAt,
    ageSeconds: Number.isFinite(age) ? Math.max(0, Math.floor(age / 1000)) : null,
    provider: snapshot.provider,
  };
}
