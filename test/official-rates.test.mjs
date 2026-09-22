import test from 'node:test';
import assert from 'node:assert/strict';
import { officialRates, parseTreasuryTwoYear, parseBundesbankTwoYear } from '../lib/official-rates.mjs';
import { GET } from '../app/api/official-rates/route.js';

const NOW = Date.parse('2026-09-22T21:00:00Z');
const usXml = `<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">
<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-09-21T00:00:00</d:NEW_DATE><d:BC_2YEAR m:type="Edm.Double">3.500</d:BC_2YEAR></m:properties></content></entry>
<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-09-22T00:00:00</d:NEW_DATE><d:BC_2YEAR m:type="Edm.Double">3.550</d:BC_2YEAR></m:properties></content></entry>
</feed>`;
const deCsv = 'DATAFLOW,TIME_PERIOD,OBS_VALUE,COMMENT\n"BBSIS","2026-09-21","2.100","2,0 years"\n"BBSIS","2026-09-22","2.120","latest"\n';
const deActualFormat = '"";BBSIS.D.I.ZAR.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A;BBSIS_FLAGS\n"";Aus der Zinsstruktur abgeleitete Renditen;\nEinheit;PROZENT;\n2026-09-20;.;Kein Wert vorhanden\n2026-09-21;3,21;\n2026-09-22;3,20;\n';

test('official 2Y parsers preserve observation dates and reject implausible or future values', () => {
  assert.deepEqual(parseTreasuryTwoYear(usXml, NOW), [{ date: '2026-09-22', value: 3.55 }, { date: '2026-09-21', value: 3.5 }]);
  assert.deepEqual(parseBundesbankTwoYear(deCsv, NOW), [{ date: '2026-09-22', value: 2.12 }, { date: '2026-09-21', value: 2.1 }]);
  assert.deepEqual(parseBundesbankTwoYear(deActualFormat, NOW), [{ date: '2026-09-22', value: 3.2 }, { date: '2026-09-21', value: 3.21 }]);
  assert.deepEqual(parseBundesbankTwoYear('TIME_PERIOD,OBS_VALUE\n2026-09-23,2.2\n2026-09-21,999\n', NOW), []);
  assert.throws(() => parseBundesbankTwoYear('<html>blocked</html>', NOW), /columns unavailable/);
});

test('daily spread uses the latest shared date, never mismatched current quotes', async () => {
  const requested = [];
  const result = await officialRates({ now: NOW, fetcher: async (url, options) => {
    requested.push(url.toString());
    assert.equal(options.redirect, 'manual');
    return new Response(url.hostname === 'home.treasury.gov' ? usXml : deCsv, { status: 200 });
  } });
  assert.equal(requested.length, 2);
  assert.equal(result.status, 'daily');
  assert.equal(result.asOf, '2026-09-22');
  assert.equal(result.spread.value, 1.43);
  assert.equal(result.spread.unit, 'percentage_points');
  assert.equal(result.frequency, 'daily');
  assert.equal(result.us2y.provider, 'U.S. Treasury');
  assert.equal(result.de2y.provider, 'Deutsche Bundesbank');
});

test('different latest dates use older shared date or fail closed', async () => {
  const oneDayGerman = 'TIME_PERIOD,OBS_VALUE\n2026-09-21,2.100\n';
  const common = await officialRates({ now: NOW, fetcher: async url => new Response(url.hostname === 'home.treasury.gov' ? usXml : oneDayGerman) });
  assert.equal(common.spread.date, '2026-09-21');
  assert.equal(common.spread.value, 1.4);
  const noCommon = await officialRates({ now: NOW, fetcher: async url => new Response(url.hostname === 'home.treasury.gov' ? usXml : 'TIME_PERIOD,OBS_VALUE\n2026-09-19,2.100\n') });
  assert.equal(noCommon.status, 'unavailable');
  assert.equal(noCommon.spread, null);
  const failed = await officialRates({ now: NOW, fetcher: async url => url.hostname === 'home.treasury.gov' ? new Response(usXml) : new Response('server error', { status: 503 }) });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.us2y.value, 3.55);
  assert.equal(failed.de2y, null);
});

test('official rates route requires dashboard authentication', async () => {
  const previous = process.env.DASHBOARD_READ_TOKEN;
  process.env.DASHBOARD_READ_TOKEN = 'r'.repeat(40);
  try { assert.equal((await GET(new Request('https://test.invalid/api/official-rates'))).status, 401); }
  finally { if (previous === undefined) delete process.env.DASHBOARD_READ_TOKEN; else process.env.DASHBOARD_READ_TOKEN = previous; }
});
