import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRoutineFxOptionWindow } from '../lib/options-calendar.mjs';

test('next routine window is today before the New York fixing hour', () => {
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-09-22T13:59:00Z')).date, '2026-09-22');
});

test('next routine window advances after 10 am New York and skips weekends', () => {
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-09-22T14:00:00Z')).date, '2026-09-23');
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-09-25T15:00:00Z')).date, '2026-09-28');
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-09-27T12:00:00Z')).date, '2026-09-28');
});

test('fixing-hour comparison follows New York daylight-saving time', () => {
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-12-01T14:59:00Z')).date, '2026-12-01');
  assert.equal(nextRoutineFxOptionWindow(Date.parse('2026-12-01T15:00:00Z')).date, '2026-12-02');
});

test('routine window is explicitly not a confirmed expiry', () => {
  assert.equal(nextRoutineFxOptionWindow(Date.now()).confirmed, false);
  assert.equal(nextRoutineFxOptionWindow(NaN), null);
});
