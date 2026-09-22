import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseFxCoverage, FX_VOTING_PAIRS } from '../lib/fx-coverage.mjs';

const now = Date.parse('2026-09-22T20:00:00Z');
const asOf = new Date(now - 1000).toISOString();
const reference = new Date(now - 3600000).toISOString();
const fixture = () => ({ source:'MT5 / FOREX.com', mode:'live', fetchedAt:asOf, maxAgeSeconds:10,
  quotes:FX_VOTING_PAIRS.map(symbol => ({ symbol, price:1.2, status:'fresh', tickAt:asOf, asOf,
    changes:{ '1h':0.02 }, references:{ '1h':reference } })) });

test('coverage names the exact missing and old FX crosses without treating them as a vote', () => {
  const market = fixture();
  market.quotes.find(q => q.symbol === 'EUR/NZD').price = null;
  market.quotes.find(q => q.symbol === 'GBP/USD').tickAt = new Date(now - 11000).toISOString();
  market.quotes.find(q => q.symbol === 'EUR/JPY').changes['1h'] = null;
  const message = diagnoseFxCoverage({ market, period:'1h', now });
  assert.match(message, /9\/12 cruces listos/);
  assert.match(message, /sin precio: EUR\/NZD/);
  assert.match(message, /tick antiguo: GBP\/USD/);
  assert.match(message, /sin histórico 1h: EUR\/JPY/);
});

test('old snapshot, demo, and misaligned FX are distinctly diagnosed', () => {
  assert.match(diagnoseFxCoverage({ market:{ ...fixture(), mode:'demo' }, now }), /modo demo/);
  assert.match(diagnoseFxCoverage({ market:fixture(), now:now+11000 }), /envío MT5 está antiguo/);
  const market = fixture();
  market.quotes.find(q => q.symbol === 'EUR/CAD').references['1h'] = new Date(now-7200000).toISOString();
  assert.match(diagnoseFxCoverage({ market, now }), /horas actuales o históricas no coinciden/);
});

test('EUR/USD is intentionally excluded from the independent twelve-cross check', () => {
  assert.equal(FX_VOTING_PAIRS.length,12);
  assert.equal(FX_VOTING_PAIRS.includes('EUR/USD'),false);
  assert.match(diagnoseFxCoverage({ market:fixture(), now }), /12 cruces parecen completos/);
});
