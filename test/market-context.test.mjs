import test from 'node:test';
import assert from 'node:assert/strict';
import { marketContext, normalizeQuotes, present, strengths, SYMBOLS, REFRESH_MS, DAILY_BUDGET } from '../lib/market-context.mjs';
import { GET } from '../app/api/market-context/route.js';

const time = Date.parse('2026-09-17T12:00:00Z');
const fixture = () => Object.fromEntries(SYMBOLS.map(symbol => [symbol, { symbol, close: '1.25', percent_change: '1', timestamp: time / 1000 }]));
function harness() {
  let clock = time, calls = 0, cooldown = 0, used = 0;
  const values = new Map(), commands = [];
  return {
    advance: ms => { clock += ms; }, calls: () => calls, used: () => used, commands,
    deps: { apiKey: 'test-secret-never-return', now: () => clock,
      storage: async command => {
        commands.push(command);
        if (command[0] === 'GET') return values.get(command[1]) || null;
        if (command[0] === 'SET') { values.set(command[1], command[2]); return 'OK'; }
        if (command[0] === 'EVAL') {
          if (clock < cooldown) return 0;
          if (used + 8 > DAILY_BUDGET) return -1;
          used += 8; cooldown = clock + REFRESH_MS; return 1;
        }
        throw Error('unexpected command');
      },
      fetcher: async (url, options) => {
        calls++;
        assert.equal(url.origin, 'https://api.twelvedata.com');
        assert.equal(url.searchParams.get('symbol'), SYMBOLS.join(','));
        assert.equal(options.redirect, 'error');
        return Response.json(fixture());
      },
    },
  };
}
test('eight quotes are normalized; invalid, missing and mismatched symbols fail safely', () => {
  const raw = fixture();
  raw['GBP/USD'].close = '';
  raw['USD/JPY'].timestamp = time / 1000 + 120;
  raw['AUD/USD'].percent_change = null;
  raw['USD/CAD'].symbol = 'USD/CHF';
  delete raw['EUR/JPY'];
  const quotes = normalizeQuotes(raw, time);
  assert.equal(quotes.length, 8);
  assert.equal(quotes.filter(q => q.price === null).length, 5);
  assert.equal(quotes[0].price, 1.25);
});
test('breadth uses correct currency orientation, flat contribution, and full coverage', () => {
  const quotes = normalizeQuotes(fixture(), time).map(q => ({ ...q, status: 'fresh' }));
  assert.equal(strengths(quotes).USD.score, 50);
  assert.equal(strengths(quotes).EUR.score, 100);
  assert.ok(strengths(quotes).USD.meanChange > 0); // exact inverse, not naive negation
  quotes.forEach(q => { q.change = 0; });
  assert.equal(strengths(quotes).EUR.score, 50);
  quotes[0].status = 'stale';
  assert.equal(strengths(quotes).USD, null);
  assert.equal(strengths(quotes).EUR, null);
});
test('timestamps expire quotes and strengths without fabricating replacements', () => {
  const snapshot = { fetchedAt: new Date(time).toISOString(), quotes: normalizeQuotes(fixture(), time) };
  const result = present(snapshot, time + 31 * 60000);
  assert.equal(result.quotes[0].status, 'stale');
  assert.equal(result.strengths.USD, null);
  assert.equal(result.quotes[0].price, 1.25);
});
test('parallel cold requests reserve a single batch; cache hits spend no credits', async () => {
  const h = harness();
  await Promise.all(Array.from({ length: 30 }, () => marketContext(h.deps)));
  const result = await marketContext(h.deps);
  assert.equal(h.calls(), 1);
  assert.equal(h.used(), 8);
  assert.equal(result.status, 'fresh');
  assert.ok(!JSON.stringify(result).includes(h.deps.apiKey));
  assert.ok(h.commands.every(c => !String(c[1]).includes(':production:snapshot')));
  h.advance(REFRESH_MS);
  await marketContext(h.deps);
  assert.equal(h.calls(), 2);
});
test('storage outage and missing API key fail closed before calling provider', async () => {
  const h = harness();
  assert.equal((await marketContext({ ...h.deps, apiKey: '' })).reason, 'not_configured');
  const result = await marketContext({ ...h.deps, storage: async () => { throw Error('private storage detail'); } });
  assert.equal(result.reason, 'storage_unavailable');
  assert.equal(h.calls(), 0);
  assert.ok(!JSON.stringify(result).includes('private storage detail'));
});
test('provider failures retain stale cache and cooldown, never exposing errors or keys', async () => {
  const h = harness();
  await marketContext(h.deps);
  h.advance(31 * 60000);
  let failedCalls = 0;
  h.deps.fetcher = async () => { failedCalls++; throw Error(h.deps.apiKey); };
  const result = await marketContext(h.deps);
  assert.equal(result.quotes[0].status, 'stale');
  assert.equal(result.strengths.USD, null);
  assert.ok(!JSON.stringify(result).includes(h.deps.apiKey));
  assert.equal((await marketContext(h.deps)).reason, 'cooldown');
  assert.equal(failedCalls, 1);
});
test('partial provider result cannot manufacture complete strength coverage', async () => {
  const h = harness(), body = fixture();
  body['EUR/GBP'] = { status: 'error', message: h.deps.apiKey };
  const result = await marketContext({ ...h.deps, fetcher: async () => Response.json(body) });
  assert.equal(result.status, 'partial_or_stale');
  assert.equal(result.strengths.EUR, null);
  assert.equal(result.strengths.USD.score, 50);
  assert.ok(!JSON.stringify(result).includes(h.deps.apiKey));
});
test('daily budget denial never contacts the provider', async () => {
  const h = harness();
  const result = await marketContext({ ...h.deps, storage: async c => c[0] === 'GET' ? null : -1 });
  assert.equal(result.reason, 'daily_budget');
  assert.equal(h.calls(), 0);
});
test('market route requires existing dashboard token and forbids shared HTTP caching', async () => {
  const old = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  process.env.DASHBOARD_READ_TOKEN = 'r'.repeat(40);
  try {
    assert.equal((await GET(new Request('https://local/api/market-context'))).status, 401);
    const result = await GET(new Request('https://local/api/market-context', { headers: { Authorization: `Bearer ${'r'.repeat(40)}` } }));
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('cache-control'), 'no-store, private');
    assert.equal((await result.json()).reason, 'not_configured');
  } finally { if (old === undefined) delete process.env.TWELVE_DATA_API_KEY; else process.env.TWELVE_DATA_API_KEY = old; }
});
