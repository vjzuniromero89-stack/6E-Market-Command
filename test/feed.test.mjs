import test from 'node:test';
import assert from 'node:assert/strict';
import { authorized, validateSnapshot, feedStatus } from '../lib/feed.mjs';

const ingest = 'i'.repeat(40), read = 'r'.repeat(40);
process.env.NINJATRADER_INGEST_TOKEN = ingest;
process.env.DASHBOARD_READ_TOKEN = read;
process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
const fixture = () => ({ schemaVersion:2, instrument:'6E 12-26', sentAt:new Date().toISOString(), barTimeUtc:new Date().toISOString(), barTimeLocal:'2026-09-22 10:15:00 -04:00', price:1.15325, open:1.153, high:1.154, low:1.152, close:1.15325, barVolume:100, bidVolume:60, askVolume:40, barDelta:-20, cumulativeDelta:-608, deltaPercent:-20, trades:25, maxPositiveDelta:5, maxNegativeDelta:-12, maxSeenDelta:7, minSeenDelta:-25, deltaSinceHigh:-10, deltaSinceLow:3 });
const request = (token, body) => new Request('https://test.invalid/api/ninjatrader', {
  method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});

test('read and ingest keys are separate and missing configuration fails closed', () => {
  assert.equal(authorized(request(read), read), true);
  assert.equal(authorized(request(ingest), read), false);
  assert.equal(authorized(request(''), ''), false);
});
test('snapshot validation rejects stale clocks, invalid instruments and impossible delta', () => {
  assert.equal(validateSnapshot(fixture()).cumulativeDelta, -608);
  for (const extra of [{ instrument: 'ES 12-26' }, { price: NaN }, { barDelta: 101 }, { sentAt: '2000-01-01' }, { barVolume: -1 }]) {
    assert.throws(() => validateSnapshot({ ...fixture(), ...extra }));
  }
  assert.equal(validateSnapshot({ ...fixture(), secret: 'must-not-be-stored' }).secret, undefined);
});
test('freshness never labels missing or old data live', () => {
  assert.equal(feedStatus(null).status, 'unavailable');
  assert.equal(feedStatus(validateSnapshot(fixture())).status, 'live');
  assert.equal(feedStatus({ sentAt:new Date(Date.now()-30000).toISOString() }).status, 'stale');
});
