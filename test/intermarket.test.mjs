import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTERMARKET_LIVE_MS, presentIntermarket, validateIntermarketSnapshot } from '../lib/intermarket.mjs';

const at = Date.parse('2026-09-22T20:00:10.000Z');
const fixture = (root = 'GC') => ({
  schemaVersion: 1, root, instrument: `${root} 12-26`,
  sentAt: new Date(at).toISOString(), barTimeUtc: new Date(at - 10_000).toISOString(),
  price: root === 'GC' ? 4400 : 70, open: root === 'GC' ? 4399 : 69.9,
  high: root === 'GC' ? 4401 : 70.1, low: root === 'GC' ? 4398 : 69.8,
  close: root === 'GC' ? 4400 : 70,
});

test('accepts GC and CL futures and removes untrusted fields', () => {
  for (const root of ['GC', 'CL']) {
    const snapshot = validateIntermarketSnapshot({ ...fixture(root), secret: 'not stored' }, at);
    assert.equal(snapshot.root, root);
    assert.equal(snapshot.secret, undefined);
    assert.equal(snapshot.source, 'ninjatrader_futures_chart');
  }
});

test('rejects non-futures symbols, old data and impossible prices', () => {
  for (const change of [
    { root: 'XAU' }, { instrument: '$XAU' }, { instrument: '6E 12-26' },
    { sentAt: new Date(at - 120_000).toISOString() }, { price: NaN },
    { price: -1 }, { high: 4390 }, { barTimeUtc: new Date(at - 180_000).toISOString() },
  ]) assert.throws(() => validateIntermarketSnapshot({ ...fixture(), ...change }, at));
});

test('only fresh quotes reveal a price; stale or missing data cannot look live', () => {
  const snapshot = validateIntermarketSnapshot(fixture(), at);
  assert.equal(presentIntermarket(snapshot, 'GC', at + 10_000).price, 4400);
  assert.equal(presentIntermarket(snapshot, 'GC', at + 10_000).open, 4399);
  assert.equal(presentIntermarket(snapshot, 'GC', at + 10_000).barTimeUtc, snapshot.barTimeUtc);
  assert.equal(presentIntermarket(snapshot, 'GC', at + INTERMARKET_LIVE_MS).status, 'stale');
  assert.equal(presentIntermarket(snapshot, 'GC', at + INTERMARKET_LIVE_MS).price, null);
  assert.equal(presentIntermarket(snapshot, 'GC', at + INTERMARKET_LIVE_MS).open, null);
  assert.equal(presentIntermarket(snapshot, 'CL', at).status, 'unavailable');
  assert.equal(presentIntermarket(null, 'GC', at).status, 'unavailable');
});

test('GC/CL indicator is independent, real-time only and sends no orders or account data', () => {
  const source = readFileSync(new URL('../ninjatrader/MarketCommandIntermarket.cs', import.meta.url), 'utf8');
  assert.match(source, /class MarketCommandIntermarket\s*:\s*Indicator/);
  assert.match(source, /State != State\.Realtime/);
  assert.match(source, /root != "GC" && root != "CL"/);
  assert.doesNotMatch(source, /SubmitOrder|EnterLong|EnterShort|Account\.|Position\.|VolumetricBarsType|\.Volumes\[/i);
});
