import { timingSafeEqual } from 'node:crypto';

export function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const LIVE_AFTER_MS = 20_000;
export const STALE_AFTER_MS = 120_000;
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min = Number.MIN_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min;

export function validateSnapshot(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 2) throw Error('Invalid schema');
  if (typeof value.instrument !== 'string' || !/^6E [A-Za-z0-9 -]{2,24}$/.test(value.instrument)) throw Error('Expected a 6E contract');
  const time = Date.parse(value.sentAt), barTime = Date.parse(value.barTimeUtc);
  if (!Number.isFinite(time) || Math.abs(time - now) > 60000) throw Error('Check the Windows clock');
  if (!Number.isFinite(barTime)) throw Error('Invalid bar timestamp');
  for (const key of ['price', 'open', 'high', 'low', 'close']) if (!finite(value[key], 0.1, 10)) throw Error(`Invalid ${key}`);
  if (value.high < Math.max(value.open, value.close, value.low) || value.low > Math.min(value.open, value.close, value.high)) throw Error('Invalid OHLC');
  for (const key of ['barVolume', 'bidVolume', 'askVolume', 'trades']) if (!integer(value[key], 0)) throw Error(`Invalid ${key}`);
  for (const key of ['barDelta', 'cumulativeDelta', 'maxPositiveDelta', 'maxNegativeDelta', 'maxSeenDelta', 'minSeenDelta', 'deltaSinceHigh', 'deltaSinceLow']) if (!integer(value[key])) throw Error(`Invalid ${key}`);
  if (!finite(value.deltaPercent, -100, 100) || Math.abs(value.barDelta) > value.barVolume) throw Error('Invalid delta');
  return {
    schemaVersion: 2, instrument: value.instrument, contract: value.instrument, price: value.price,
    open: value.open, high: value.high, low: value.low, close: value.close,
    barVolume: value.barVolume, bidVolume: value.bidVolume, askVolume: value.askVolume,
    barDelta: value.barDelta, cumulativeDelta: value.cumulativeDelta, deltaPercent: value.deltaPercent,
    trades: value.trades, maxPositiveDelta: value.maxPositiveDelta, maxNegativeDelta: value.maxNegativeDelta,
    maxSeenDelta: value.maxSeenDelta, minSeenDelta: value.minSeenDelta,
    deltaSinceHigh: value.deltaSinceHigh, deltaSinceLow: value.deltaSinceLow,
    barTimeUtc: new Date(barTime).toISOString(), barTimeLocal: String(value.barTimeLocal || '').slice(0, 40),
    sentAt: new Date(time).toISOString(), receivedAt: new Date(now).toISOString(),
    source: 'ninjatrader_volumetric', provider: 'CME via NinjaTrader 8', latencyMs: Math.max(0, now - time),
  };
}

export function feedStatus(snapshot, now = Date.now()) {
  if (!snapshot) return { status: 'unavailable', freshnessMs: null };
  const freshnessMs = Math.max(0, now - Date.parse(snapshot.sentAt));
  return { status: freshnessMs < LIVE_AFTER_MS ? 'live' : 'stale', freshnessMs };
}
