import test from 'node:test';
import assert from 'node:assert/strict';
import { authorized, validateSnapshot } from '../lib/feed.mjs';
import { GET, POST } from '../app/api/ninjatrader/route.js';

const ingest = 'i'.repeat(40), read = 'r'.repeat(40);
process.env.NINJATRADER_INGEST_TOKEN = ingest;
process.env.DASHBOARD_READ_TOKEN = read;
process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
const fixture = () => ({ schemaVersion: 1, instrument: '6E 12-26', sentAt: new Date().toISOString(), barTime: '2026-09-17 10:15:00', price: 1.15325, barVolume: 100, barDelta: -20, cumulativeDelta: -608 });
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
test('route roundtrip, expiration, storage errors and authorization', async () => {
  const originalFetch = globalThis.fetch;
  let stored = null;
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === 'EVAL') {
      if (!stored || JSON.parse(stored).sentAt < command[5]) stored = command[4];
      return Response.json({ result: 1 });
    }
    return Response.json({ result: stored });
  };
  try {
    assert.equal((await POST(request(read, fixture()))).status, 401);
    assert.equal((await GET(request(ingest))).status, 401);
    assert.equal((await (await GET(request(read))).json()).status, 'waiting');
    assert.equal((await POST(request(ingest, '{bad'))).status, 400);
    assert.equal((await POST(request(ingest, 'x'.repeat(9000)))).status, 413);
    assert.equal((await POST(request(ingest, fixture()))).status, 200);
    const response = await GET(request(read));
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    const body = await response.json();
    assert.equal(body.status, 'live');
    assert.equal(body.snapshot.price, 1.15325);
    const old = { ...fixture(), sentAt: new Date(Date.now() - 30000).toISOString() };
    await POST(request(ingest, old));
    assert.equal((await (await GET(request(read))).json()).status, 'live');
    stored = JSON.stringify(validateSnapshot(old));
    assert.equal((await (await GET(request(read))).json()).status, 'stale');
    stored = null;
    assert.equal((await (await GET(request(read))).json()).snapshot, null);
    globalThis.fetch = async () => { throw Error('offline'); };
    assert.equal((await GET(request(read))).status, 503);
    assert.equal((await POST(request(ingest, fixture()))).status, 503);
  } finally { globalThis.fetch = originalFetch; }
});
