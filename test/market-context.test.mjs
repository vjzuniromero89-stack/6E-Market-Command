import test from 'node:test';
import assert from 'node:assert/strict';
import { marketContext, normalizeQuotes, present, strengths, SYMBOLS, REFRESH_MS, DAILY_BUDGET } from '../lib/market-context.mjs';
import { GET } from '../app/api/market-context/route.js';

const time = Date.parse('2026-09-17T12:00:00Z');
const fixture = () => Object.fromEntries(SYMBOLS.map(symbol => [symbol, { meta:{symbol, interval:'5min'}, status:'ok', values: Array.from({length:400}, (_,i)=>({datetime:new Date(time-(i+1)*300000).toISOString().slice(0,19).replace('T',' '),close:String(1.25-i*0.001)})) }]));
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
        assert.equal(url.pathname, '/time_series');
        assert.equal(url.searchParams.get('interval'), '5min');
        assert.equal(url.searchParams.get('outputsize'), '400');
        assert.equal(url.searchParams.get('timezone'), 'UTC');
        assert.equal(options.redirect, 'error');
        return Response.json(fixture());
      },
    },
  };
}
test('eight quotes are normalized; invalid, missing and mismatched symbols fail safely', () => {
  const raw = fixture();
  raw['GBP/USD'].values = [];
  raw['USD/JPY'].meta.interval = '1day';
  raw['AUD/USD'].values.forEach(q=>q.close=null);
  raw['USD/CAD'].meta.symbol = 'USD/CHF';
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
  quotes.forEach(q => { q.changes = {'15m':0,'1h':0,day:0}; });
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
test('migration isolates daily snapshots without resetting the existing quota or cooldown', async () => {
  const h = harness();
  const commands = [];
  const oldSnapshot = JSON.stringify({ fetchedAt: new Date(time).toISOString(), quotes: normalizeQuotes(fixture(), time) });
  const result = await marketContext({ ...h.deps, storage: async command => {
    commands.push(command);
    if (command[0] === 'GET') return command[1].endsWith(':snapshot') ? oldSnapshot : null;
    if (command[0] === 'EVAL') return 0; // Existing deployment's 20-minute reservation.
    throw Error('must not write or reset quota');
  } });
  assert.equal(result.reason, 'cooldown');
  assert.equal(result.fetchedAt, null);
  assert.equal(h.calls(), 0);
  assert.ok(commands[0][1].endsWith(':snapshot:strength-v3'));
  assert.match(commands[1][3], /^6emc:td:v1:[a-f0-9]{24}:cooldown$/);
  assert.match(commands[1][4], /^6emc:td:v1:[a-f0-9]{24}:budget$/);
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

test('actual 15m and 1h returns use exact historical closes, with UTC day reference', () => {
  const q=normalizeQuotes(fixture(),time)[0];
  assert.ok(Math.abs(q.changes['15m'] - (1.25/1.247-1)*100)<1e-10);
  assert.ok(Math.abs(q.changes['1h'] - (1.25/1.238-1)*100)<1e-10);
  assert.equal(q.references.day,'2026-09-17T00:00:00.000Z');
  assert.ok(Math.abs(q.changes.day - (1.25/1.106-1)*100)<1e-10);
});
test('incomplete and future candles never become the current price', () => {
  const body=fixture();
  body['EUR/USD'].values.unshift({datetime:'2026-09-17 12:00:00',close:'999'});
  assert.equal(normalizeQuotes(body,time+60000)[0].price,1.25);
});
test('missing bars invalidate only affected horizons without substituting another day', () => {
  const body=fixture();
  body['EUR/USD'].values.splice(6,1);
  const q=normalizeQuotes(body,time)[0];
  assert.notEqual(q.changes['15m'],null);
  assert.equal(q.changes['1h'],null);
  assert.equal(q.changes.day,null);
});
test('different latest bars align all comparisons to one common close', () => {
  const body=fixture(); body['EUR/JPY'].values.shift();
  const quotes=normalizeQuotes(body,time);
  assert.equal(new Set(quotes.map(q=>q.asOf)).size,1);
  assert.equal(quotes[0].asOf,new Date(time-300000).toISOString());
});
test('tiny movements are neutral, and directions can differ by horizon', () => {
  const quotes=normalizeQuotes(fixture(),time).map(q=>({...q,status:'fresh',changes:{'15m':0.001,'1h':0.5,day:-0.5}}));
  assert.equal(strengths(quotes,'15m').EUR.score,50);
  assert.equal(strengths(quotes,'15m').USD.score,50);
  assert.equal(strengths(quotes,'1h').EUR.score,100);
  assert.equal(strengths(quotes,'day').EUR.score,0);
});
test('UTC midnight and stale data do not carry yesterday into the new day', () => {
  const quotes=normalizeQuotes(fixture(),time-12*3600000);
  assert.equal(quotes[0].changes.day,null);
  const result=present({fetchedAt:new Date(time).toISOString(),quotes:normalizeQuotes(fixture(),time)},time+31*60000);
  assert.equal(result.periods['15m'].USD,null);
  assert.equal(result.periods['1h'].EUR,null);
  assert.equal(result.periods.day.EUR,null);
});

test('a new UTC day clears only daily returns even while cache is recent', () => {
  const end=Date.parse('2026-09-17T23:55:00Z');
  const quotes=normalizeQuotes(fixture(),time).map(q=>({...q,asOf:new Date(end).toISOString()}));
  const result=present({fetchedAt:new Date(end).toISOString(),quotes},Date.parse('2026-09-18T00:01:00Z'));
  assert.equal(result.periods.day.EUR,null);
  assert.notEqual(result.periods['1h'].EUR,null);
  assert.equal(result.quotes[0].changes.day,null);
});
