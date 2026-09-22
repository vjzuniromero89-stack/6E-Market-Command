export const ENGINE_DEFINITIONS = Object.freeze({
  eur: { instruments:['EURUSD','EURGBP','EURJPY','EURCHF','EURCAD','EURAUD','EURNZD'], description:'EUR breadth normalized by volatility' },
  usd: { instruments:['EURUSD','GBPUSD','AUDUSD','NZDUSD','USDJPY','USDCHF','USDCAD'], description:'G7 USD breadth from verified MT5 quotes' },
  usdExEur: { instruments:['GBPUSD','AUDUSD','NZDUSD','USDJPY','USDCHF','USDCAD'], description:'G7 USD breadth excluding EUR' },
  dxy: { instruments:['DXY'], description:'Independent dollar-index confirmation' },
  rates: { instruments:['US2Y','DE2Y','US10Y','DE10Y'], description:'US-Germany rate differentials' },
  rithmic: { instruments:['6E'], description:'Future Rithmic tick/depth adapter' },
});
export const unavailableEngines = () => Object.fromEntries(Object.entries(ENGINE_DEFINITIONS).map(([key, value]) => [key, { ...value, status:'unavailable', provider:null, asOf:null, score:null, coverage:0, reason:'No verified provider snapshot is connected. Never promoted to LIVE.' }]));

const orientation = (symbol, currency) => symbol.startsWith(currency) ? 1 : symbol.endsWith(currency) ? -1 : 0;
const clamp = value => Math.max(0, Math.min(100, value));

// Provider-neutral breadth calculation. Every input must carry a verified status;
// missing/stale members reduce coverage and can never result in LIVE output.
export function calculateCurrencyEngine(key, quotes, horizon = '15m') {
  const definition = ENGINE_DEFINITIONS[key];
  if (!definition || !['eur','usd','usdExEur'].includes(key)) throw Error('Unknown currency engine');
  const currency = key === 'eur' ? 'EUR' : 'USD';
  const expected = definition.instruments;
  const usable = expected.map(symbol => quotes.find(q => q.symbol === symbol)).filter(q => q?.status === 'live' && Number.isFinite(q.changes?.[horizon]));
  const coverage = usable.length / expected.length;
  if (!usable.length) return { ...definition, status:'unavailable', provider:null, asOf:null, score:null, coverage:0, horizon };
  const impulses = usable.map(q => orientation(q.symbol, currency) * q.changes[horizon] / Math.max(q.volatility?.[horizon] || 0.05, 0.01));
  const normalized = impulses.reduce((sum, value) => sum + Math.tanh(value), 0) / impulses.length;
  const score = clamp(50 + normalized * 50);
  const allFresh = coverage === 1 && usable.every(q => q.provider && q.asOf);
  return { ...definition, status:allFresh ? 'live' : 'partial', provider:allFresh ? [...new Set(usable.map(q => q.provider))].join(' + ') : null,
    asOf:allFresh ? usable.map(q => q.asOf).sort().at(0) : null, score, coverage, horizon,
    direction:score > 55 ? 'strong' : score < 45 ? 'weak' : 'neutral' };
}

export function calculateRatesEngine(quotes) {
  const definition = ENGINE_DEFINITIONS.rates;
  const get = symbol => quotes.find(q => q.symbol === symbol && q.status === 'live' && Number.isFinite(q.value));
  const us2 = get('US2Y'), de2 = get('DE2Y'), us10 = get('US10Y'), de10 = get('DE10Y');
  if (!us2 || !de2) return { ...definition, status:'unavailable', provider:null, asOf:null, score:null, coverage:[us2,de2,us10,de10].filter(Boolean).length/4 };
  const complete = Boolean(us10 && de10);
  return { ...definition, status:complete ? 'live' : 'partial', provider:complete ? [...new Set([us2,de2,us10,de10].map(q=>q.provider))].join(' + ') : null,
    asOf:[us2,de2,us10,de10].filter(Boolean).map(q=>q.asOf).sort().at(0), score:null, coverage:complete ? 1 : 0.5,
    spreads:{ twoYear:us2.value-de2.value, tenYear:complete ? us10.value-de10.value : null } };
}
