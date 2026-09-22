import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');

test('options research links use official CME pages without presenting an estimated expiry as confirmed', () => {
  assert.match(page, /euro-fx\.calendar\.options\.html/);
  assert.match(page, /euro-fx\.quotes\.options\.html/);
  assert.match(page, /options-open-interest-profile\.html/);
  assert.match(page, /market-data\/daily-bulletin\.html/);
  assert.match(page, /cme-group-volatility-indexes\.html/);
  assert.match(page, /trading\/fx\/currfixprice\.html/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /nextRoutineFxOptionWindow|PRÓXIMA VENTANA ORDINARIA/);
});

test('options are labeled as not connected and are not included in the general engine calculation', () => {
  const engine = readFileSync(new URL('../lib/general-engine.mjs', import.meta.url), 'utf8');
  assert.match(page, /OPCIONES SIN FEED/);
  assert.match(page, /no vota en el Engine General/);
  assert.doesNotMatch(engine, /option|opci[oó]n|gamma/i);
});
