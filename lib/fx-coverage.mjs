// The two independent baskets use six crosses each; EUR/USD is not a vote.
export const FX_VOTING_PAIRS = Object.freeze([
  'GBP/USD', 'AUD/USD', 'NZD/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/CAD', 'EUR/AUD', 'EUR/NZD',
]);

export function diagnoseFxCoverage({ market, period = '1h', now = Date.now() } = {}) {
  if (!market) return 'Esperando la respuesta del motor FX; comprueba la conexión MT5 y la clave de lectura.';
  if (market.source !== 'MT5 / FOREX.com') return 'La fuente FX actual no es MT5 live; no se usa para el análisis conjunto intradía.';
  if (market.mode !== 'live') return `MT5 está en modo ${market.mode === 'demo' ? 'demo' : 'no confirmado'}; no se asigna dirección live.`;
  const maxAge = (market.maxAgeSeconds || 10) * 1000;
  const fetched = Date.parse(market.fetchedAt);
  if (!Number.isFinite(fetched) || now < fetched || now - fetched > maxAge)
    return 'El último envío MT5 está antiguo o no tiene hora verificable; espera un envío reciente.';
  const quotes = new Map((market.quotes || []).map(q => [q.symbol, q]));
  const missing = [], stale = [], history = [], aligned = [];
  for (const symbol of FX_VOTING_PAIRS) {
    const q = quotes.get(symbol);
    if (!q || !Number.isFinite(q.price)) { missing.push(symbol); continue; }
    const tick = Date.parse(q.tickAt);
    if (q.status !== 'fresh' || !Number.isFinite(tick) || now < tick || now - tick > maxAge) { stale.push(symbol); continue; }
    if (!Number.isFinite(q.changes?.[period]) || !q.references?.[period]) { history.push(symbol); continue; }
    aligned.push(q);
  }
  const groups = [
    ['sin precio', missing], ['tick antiguo', stale], [`sin histórico ${period}`, history],
  ].filter(([,symbols]) => symbols.length).map(([label,symbols]) =>
    `${label}: ${symbols.slice(0, 4).join(', ')}${symbols.length > 4 ? ` y ${symbols.length - 4} más` : ''}`);
  if (groups.length) return `${FX_VOTING_PAIRS.length - missing.length - stale.length - history.length}/12 cruces listos. ${groups.join(' · ')}.`;
  const asOf = new Set(aligned.map(q => q.asOf));
  const reference = new Set(aligned.map(q => q.references[period]));
  if (asOf.size !== 1 || reference.size !== 1) return 'Los 12 cruces tienen datos, pero sus horas actuales o históricas no coinciden.';
  return 'Los 12 cruces parecen completos; esperando que el servidor confirme las dos cestas sincronizadas.';
}
