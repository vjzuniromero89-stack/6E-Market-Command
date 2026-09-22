import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/intermarket/route.js';

const ingest = 'i'.repeat(40);
const read = 'r'.repeat(40);
const endpoint = 'https://dashboard.test/api/intermarket';
const request = (token, body) => new Request(endpoint, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('GC ingest uses the existing private tables and read endpoint hides missing CL', async () => {
  const previousFetch = globalThis.fetch;
  const previous = {
    ingest: process.env.NINJATRADER_INGEST_TOKEN, read: process.env.DASHBOARD_READ_TOKEN,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.NINJATRADER_INGEST_TOKEN = ingest;
  process.env.DASHBOARD_READ_TOKEN = read;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  const calls = [];
  let saved;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (String(url).includes('market_feed_latest')) saved = body.payload;
      return new Response(null, { status: 204 });
    }
    return Response.json(String(url).includes('like.GC') ? [{ payload: saved }] : []);
  };
  try {
    assert.equal((await POST(request(read, {}))).status, 401);
    assert.equal((await GET(request(ingest))).status, 401);
    const now = Date.now();
    const snapshot = { schemaVersion: 1, root: 'GC', instrument: 'GC 12-26',
      sentAt: new Date(now).toISOString(), barTimeUtc: new Date(now - 10_000).toISOString(),
      price: 4400, open: 4399, high: 4401, low: 4398, close: 4400 };
    assert.equal((await POST(request(ingest, snapshot))).status, 200);
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 2);
    assert.ok(calls.some(call => call.url.includes('market_feed_latest?on_conflict=instrument')));
    assert.ok(calls.some(call => call.url.includes('data_sources?on_conflict=source_key')));
    const result = await GET(request(read));
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(body.quotes.GC.status, 'live');
    assert.equal(body.quotes.GC.price, 4400);
    assert.equal(body.quotes.CL.status, 'unavailable');
    assert.equal(body.quotes.CL.price, null);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      NINJATRADER_INGEST_TOKEN: previous.ingest, DASHBOARD_READ_TOKEN: previous.read,
      NEXT_PUBLIC_SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key,
    })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
