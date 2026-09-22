import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGeneralEngine } from '../lib/general-engine.mjs';
import { calculateStrengths } from '../lib/timeframes.mjs';

const now = Date.parse('2026-09-22T20:00:00Z');
const market = { source:'MT5 / FOREX.com', mode:'live' };
const basket = (rising, falling) => ({ rising, falling, neutral:6-rising-falling, count:6,
  asOf:'2026-09-22T19:59:00Z', reference:'2026-09-22T18:59:00Z', period:'1h' });

test('EUR/USD alone cannot move either independent basket', () => {
  const symbols = ['EUR/USD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD',
    'EUR/GBP','EUR/JPY','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD'];
  const quotes = symbols.map(symbol => ({ symbol, status:'fresh', asOf:'2026-09-22T19:59:00Z',
    changes:{ '1h':symbol === 'EUR/USD' ? 0.1 : 0 }, references:{ '1h':'2026-09-22T18:59:00Z' } }));
  const strength = calculateStrengths(quotes, '1h');
  assert.equal(strength.EUR_EX_USD.score, 50);
  assert.equal(strength.USD_EX_EUR.score, 50);
  assert.equal(evaluateGeneralEngine({ strength, market, now }).fxBias, 'mixed');
});

test('aligned independent breadth can describe an upward FX bias but never a trade probability', () => {
  const result = evaluateGeneralEngine({ strength:{ EUR_EX_USD:basket(5,1), USD_EX_EUR:basket(1,5) }, market, now });
  assert.equal(result.fxBias, 'up');
  assert.equal(result.eur.net, 4);
  assert.equal(result.usd.net, -4);
  assert.equal(result.probability, null);
  assert.equal(result.entrySignal, false);
});

test('opposite independent breadth describes downward FX bias', () => {
  const result = evaluateGeneralEngine({ strength:{ EUR_EX_USD:basket(1,5), USD_EX_EUR:basket(5,1) }, market, now });
  assert.equal(result.fxBias, 'down');
});

test('conflicting breadth is mixed, not a forced direction', () => {
  const result = evaluateGeneralEngine({ strength:{ EUR_EX_USD:basket(5,1), USD_EX_EUR:basket(5,1) }, market, now });
  assert.equal(result.fxBias, 'mixed');
});

test('missing or misaligned basket fails closed', () => {
  const usd = basket(1,5);
  assert.equal(evaluateGeneralEngine({ strength:{ EUR_EX_USD:basket(5,1) }, market, now }).fxBias, 'unavailable');
  assert.equal(evaluateGeneralEngine({ strength:{ EUR_EX_USD:basket(5,1), USD_EX_EUR:{ ...usd, asOf:'2026-09-22T19:58:00Z' } }, market, now }).fxBias, 'unavailable');
});

test('demo and historical FX never produce a scalping bias', () => {
  const strength = { EUR_EX_USD:basket(5,1), USD_EX_EUR:basket(1,5) };
  assert.equal(evaluateGeneralEngine({ strength, market:{ ...market, mode:'demo' }, now }).fxBias, 'unavailable');
  assert.equal(evaluateGeneralEngine({ strength, market:{ source:'Twelve Data' }, now }).fxBias, 'unavailable');
});

test('live 6E and GC/CL status are checked independently without becoming votes', () => {
  const result = evaluateGeneralEngine({ now,
    ninja:{ status:'live', snapshot:{ instrument:'6E DEC26', sentAt:new Date(now-5_000).toISOString() } },
    intermarket:{ quotes:{ GC:{ status:'live', price:3800, asOf:new Date(now-3_000).toISOString() }, CL:{ status:'live', price:80, asOf:new Date(now-30_000).toISOString() } } },
    rates:{ status:'daily', spread:{ value:1.5 } },
  });
  assert.equal(result.ninjaLive, true);
  assert.deepEqual(result.intermarketLive, ['GC']);
  assert.equal(result.ratesDaily, true);
  assert.equal(result.fxBias, 'unavailable');
  assert.equal(result.entrySignal, false);
});
