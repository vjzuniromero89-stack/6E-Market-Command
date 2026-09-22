import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyBrief } from '../lib/daily-brief.mjs';
import { evaluateGeneralEngine } from '../lib/general-engine.mjs';

const now = Date.parse('2026-09-22T20:00:00Z');

test('missing feeds remain explicitly unverified, including an option expiring today', () => {
  const brief = buildDailyBrief(evaluateGeneralEngine({ now }));
  assert.match(brief.items.find(item => item.label === 'Opciones 6E').text, /No se puede verificar si vence una opción hoy/);
  assert.match(brief.items.find(item => item.label === '6E').text, /No hay una lectura reciente/);
  assert.equal(brief.probability, null);
  assert.equal(brief.entrySignal, false);
});

test('current observations are described with their own horizons, without forced direction', () => {
  const general = evaluateGeneralEngine({ now,
    ninja:{ status:'live', snapshot:{ instrument:'6E DEC26', sentAt:new Date(now-1_000).toISOString(), open:1.15, price:1.151 } },
    intermarket:{ quotes:{ GC:{ status:'live', price:4401, open:4400, asOf:new Date(now-1_000).toISOString() } } },
    rates:{ status:'daily', spread:{ value:1.51, date:'2026-09-22' } },
  });
  const brief = buildDailyBrief(general);
  assert.match(brief.items.find(item => item.label === '6E reciente').text, /barra actual/);
  assert.match(brief.items.find(item => item.label === 'Oro futuro').text, /barra no comparable/);
  assert.match(brief.items.find(item => item.label === 'Tasas 2 años').text, /al cierre 2026-09-22/);
  assert.match(brief.items.find(item => item.label === 'Lectura conjunta').text, /Aún no hay/);
  assert.equal(brief.probability, null);
});
