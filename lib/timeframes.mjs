export const PERIODS = ['15m', '1h', 'day'];
export const NEUTRAL_PERCENT = 0.01;
const STEP = 300000;
const positive = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) ? Number(value) : NaN;

// Only completed five-minute candles. Provider datetimes explicitly requested in UTC.
export function normalizeSeries(body, symbols, now) {
  const series = symbols.map(symbol => {
    const raw = body?.[symbol];
    const bars = new Map();
    if (raw?.status !== 'error' && raw?.meta?.symbol === symbol && raw.meta.interval === '5min' && Array.isArray(raw.values)) {
      for (const row of raw.values) {
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.datetime || '')) continue;
        const start = Date.parse(row.datetime.replace(' ', 'T') + 'Z');
        const close = positive(row.close);
        if (!Number.isFinite(start) || start % STEP || start + STEP > now || !Number.isFinite(close) || close <= 0) continue;
        if (bars.has(start + STEP)) { bars.clear(); break; } // Ambiguous duplicate: fail closed.
        bars.set(start + STEP, close);
      }
    }
    return { symbol, bars };
  });
  const latest = series.filter(s => s.bars.size).map(s => Math.max(...s.bars.keys()));
  const end = latest.length ? Math.min(...latest) : null;
  return series.map(({ symbol, bars }) => {
    const price = bars.get(end) ?? null;
    const day = end === null ? null : Math.floor(end / 86400000) * 86400000;
    const starts = { '15m': end - 900000, '1h': end - 3600000, day };
    const changes = {}, references = {};
    for (const period of PERIODS) {
      const start = starts[period];
      references[period] = end !== null ? new Date(start).toISOString() : null;
      // Require every candle in the window: no bridging weekends, outages or gaps.
      let complete = price !== null && start < end;
      for (let t = start; complete && t <= end; t += STEP) complete = bars.has(t);
      changes[period] = complete ? (price / bars.get(start) - 1) * 100 : null;
    }
    return { symbol, price, asOf: price !== null ? new Date(end).toISOString() : null,
      changes, references, change: changes['1h'], status: price === null ? 'unavailable' : 'available' };
  });
}

export function calculateStrengths(quotes, period = '1h') {
  const calculate = entries => {
    const components = entries.map(([symbol, inverse]) => {
      const q = quotes.find(q => q.symbol === symbol && q.status === 'fresh');
      const change = q?.changes?.[period];
      if (!Number.isFinite(change) || change <= -100) return null;
      return { change: inverse ? (1 / (1 + change / 100) - 1) * 100 : change, asOf: q.asOf, reference: q.references[period] };
    });
    if (components.some(c => !c) || new Set(components.map(c => c.asOf)).size !== 1 || new Set(components.map(c => c.reference)).size !== 1) return null;
    const values = components.map(c => c.change);
    const rising = values.filter(v => v > NEUTRAL_PERCENT).length;
    const falling = values.filter(v => v < -NEUTRAL_PERCENT).length;
    const neutral = values.length - rising - falling;
    return { score: Math.round(100 * (rising + neutral / 2) / values.length), meanChange: values.reduce((a,b) => a+b,0) / values.length,
      count: values.length, rising, falling, neutral, asOf: components[0].asOf, reference: components[0].reference, period };
  };
  const expanded = ['NZD/USD','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD'].every(symbol => quotes.some(q => q.symbol === symbol));
  const usd = expanded
    ? [['EUR/USD',true],['GBP/USD',true],['AUD/USD',true],['NZD/USD',true],['USD/JPY',false],['USD/CHF',false],['USD/CAD',false]]
    : [['EUR/USD',true],['GBP/USD',true],['AUD/USD',true],['USD/JPY',false],['USD/CHF',false],['USD/CAD',false]];
  const eur = expanded
    ? [['EUR/USD',false],['EUR/GBP',false],['EUR/JPY',false],['EUR/CHF',false],['EUR/CAD',false],['EUR/AUD',false],['EUR/NZD',false]]
    : [['EUR/USD',false],['EUR/GBP',false],['EUR/JPY',false]];
  return { USD: calculate(usd), EUR: calculate(eur), USD_EX_EUR: calculate(usd.filter(([symbol]) => symbol !== 'EUR/USD')) };
}
