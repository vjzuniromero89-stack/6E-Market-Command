// Derived two-year annual-coupon yield, closer in definition to the U.S. par curve
// than the Bundesbank's two-year zero-coupon series.
const DE_SERIES = 'D.I.ZAR.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A';
export const OFFICIAL_RATES_SOURCES = Object.freeze({
  us: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml',
  de: `https://api.statistiken.bundesbank.de/rest/data/BBSIS/${DE_SERIES}`,
});

function validDate(value, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && time <= now;
}

function validYield(value) {
  const number = Number(value);
  return value !== '' && Number.isFinite(number) && number > -10 && number < 30 ? number : null;
}

export function parseTreasuryTwoYear(xml, now = Date.now()) {
  if (typeof xml !== 'string' || xml.length > 2_000_000) throw Error('Invalid Treasury response');
  const observations = [];
  const entries = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/g) || [];
  for (const entry of entries) {
    const date = entry.match(/<d:NEW_DATE(?:\s[^>]*)?>(\d{4}-\d{2}-\d{2})[^<]*<\/d:NEW_DATE>/)?.[1];
    const raw = entry.match(/<d:BC_2YEAR(?:\s[^>]*)?>([^<]+)<\/d:BC_2YEAR>/)?.[1]?.trim();
    const value = validYield(raw);
    if (validDate(date, now) && value !== null) observations.push({ date, value });
  }
  return observations.sort((a, b) => b.date.localeCompare(a.date));
}

function csvRows(csv, delimiter = ',') {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (quoted) throw Error('Invalid Bundesbank CSV');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseBundesbankTwoYear(csv, now = Date.now()) {
  if (typeof csv !== 'string' || csv.length > 2_000_000) throw Error('Invalid Bundesbank response');
  const normalized = csv.replace(/^\uFEFF/, '');
  // This endpoint currently serves Bundesbank's semicolon CSV (decimal comma),
  // while its API documentation also describes SDMX comma CSV.
  const bundesbankCsv = normalized.startsWith('"";');
  const rows = csvRows(normalized, bundesbankCsv ? ';' : ',');
  const header = rows[0]?.map(value => value.trim().toUpperCase()) || [];
  const dateIndex = header.indexOf('TIME_PERIOD'), valueIndex = header.indexOf('OBS_VALUE');
  if (!bundesbankCsv && (dateIndex < 0 || valueIndex < 0)) throw Error('Bundesbank CSV columns unavailable');
  const observations = [];
  for (const row of rows.slice(1)) {
    const date = row[bundesbankCsv ? 0 : dateIndex]?.trim();
    const raw = row[bundesbankCsv ? 1 : valueIndex]?.trim();
    const value = validYield(bundesbankCsv ? raw?.replace(',', '.') : raw);
    if (validDate(date, now) && value !== null) observations.push({ date, value });
  }
  return observations.sort((a, b) => b.date.localeCompare(a.date));
}

async function getText(url, fetcher, accept) {
  const response = await fetcher(url, { cache: 'no-store', redirect: 'manual', headers: { Accept: accept }, signal: AbortSignal.timeout(12000) });
  if (!response.ok || response.status >= 300) throw Error(`Official source HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 2_000_000) throw Error('Official source response too large');
  return body;
}

export async function officialRates({ fetcher = fetch, now = Date.now() } = {}) {
  const year = new Date(now).getUTCFullYear();
  const usUrl = new URL(OFFICIAL_RATES_SOURCES.us);
  usUrl.searchParams.set('data', 'daily_treasury_yield_curve');
  usUrl.searchParams.set('field_tdr_date_value', String(year));
  const deUrl = new URL(OFFICIAL_RATES_SOURCES.de);
  deUrl.searchParams.set('format', 'csv');
  deUrl.searchParams.set('startPeriod', `${year}-01-01`);
  const [usResult, deResult] = await Promise.allSettled([
    getText(usUrl, fetcher, 'application/xml').then(body => parseTreasuryTwoYear(body, now)),
    getText(deUrl, fetcher, 'text/csv').then(body => parseBundesbankTwoYear(body, now)),
  ]);
  const us = usResult.status === 'fulfilled' ? usResult.value : [];
  const de = deResult.status === 'fulfilled' ? deResult.value : [];
  const maxAgeDays = 7;
  const fresh = observation => observation && now - Date.parse(`${observation.date}T00:00:00Z`) <= maxAgeDays * 86400000;
  const usLatest = fresh(us[0]) ? us[0] : null;
  const deLatest = fresh(de[0]) ? de[0] : null;
  const deByDate = new Map(de.map(item => [item.date, item]));
  const common = us.find(item => fresh(item) && deByDate.has(item.date)) || null;
  const germanCommon = common ? deByDate.get(common.date) : null;
  return {
    status: common ? 'daily' : 'unavailable',
    frequency: 'daily',
    checkedAt: new Date(now).toISOString(),
    asOf: common?.date || null,
    diagnostics: {
      us: usResult.status === 'rejected' ? 'source_error' : us.length ? 'observations_received' : 'no_observations',
      de: deResult.status === 'rejected' ? 'source_error' : de.length ? 'observations_received' : 'no_observations',
    },
    us2y: usLatest ? { ...usLatest, provider: 'U.S. Treasury', source: usUrl.toString() } : null,
    de2y: deLatest ? { ...deLatest, provider: 'Deutsche Bundesbank', source: deUrl.toString() } : null,
    spread: common ? { value: Math.round((common.value - germanCommon.value) * 1000) / 1000, unit: 'percentage_points', date: common.date,
      usValue: common.value, deValue: germanCommon.value } : null,
    reason: common ? null : !usLatest && !deLatest ? 'sources_unavailable_or_stale' : 'no_recent_shared_date',
  };
}
