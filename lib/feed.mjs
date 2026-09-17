import { timingSafeEqual } from 'node:crypto';

export function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validateSnapshot(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) throw Error('Invalid schema');
  if (typeof value.instrument !== 'string' || !/^6E [A-Za-z0-9 -]{2,24}$/.test(value.instrument)) throw Error('Expected a 6E contract');
  const time = Date.parse(value.sentAt);
  if (!Number.isFinite(time) || Math.abs(time - now) > 60000) throw Error('Check the Windows clock');
  if (!Number.isFinite(value.price) || value.price <= 0 || value.price > 100) throw Error('Invalid price');
  for (const key of ['barVolume', 'barDelta', 'cumulativeDelta']) {
    if (!Number.isSafeInteger(value[key])) throw Error('Invalid volume or delta');
  }
  if (value.barVolume < 0 || Math.abs(value.barDelta) > value.barVolume) throw Error('Invalid bar volume');
  if (typeof value.barTime !== 'string' || value.barTime.length > 40) throw Error('Invalid bar time');
  return {
    schemaVersion: 1, instrument: value.instrument, price: value.price,
    barVolume: value.barVolume, barDelta: value.barDelta,
    cumulativeDelta: value.cumulativeDelta, barTime: value.barTime,
    sentAt: new Date(time).toISOString(), receivedAt: new Date(now).toISOString(),
    source: 'NinjaTrader 8 / Volumetric',
  };
}

export async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw Error('Storage not configured');
  const response = await fetch(url, {
    method: 'POST', redirect: 'error', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error('Storage unavailable');
  const body = await response.json();
  if (body.error) throw Error('Storage command failed');
  return body.result;
}

export const feedKey = () => `6emc:${process.env.FEED_NAMESPACE || 'production'}:snapshot`;
