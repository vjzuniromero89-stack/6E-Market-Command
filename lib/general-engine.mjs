const NET_THRESHOLD = 2;

// This is a descriptive FX breadth assessment, not a probability or an entry signal.
// EUR/USD is removed from both baskets so its movement cannot vote twice.
export function evaluateGeneralEngine({ strength, market, ninja, rates, intermarket, now = Date.now() } = {}) {
  const eur = strength?.EUR_EX_USD;
  const usd = strength?.USD_EX_EUR;
  const asOf = Date.parse(eur?.asOf);
  const fetchedAt = Date.parse(market?.fetchedAt);
  const maxAgeMs = (market?.maxAgeSeconds || 10) * 1000;
  const current = Number.isFinite(asOf) && now >= asOf && now - asOf <= maxAgeMs &&
    (!market?.fetchedAt || (Number.isFinite(fetchedAt) && now >= fetchedAt && now - fetchedAt <= maxAgeMs));
  const aligned = market?.source === 'MT5 / FOREX.com' && market?.mode === 'live' &&
    current &&
    eur?.count === 6 && usd?.count === 6 &&
    eur.asOf && eur.asOf === usd.asOf && eur.reference === usd.reference && eur.period === usd.period;
  const eurNet = aligned ? eur.rising - eur.falling : null;
  const usdNet = aligned ? usd.rising - usd.falling : null;
  let fxBias = 'unavailable';
  if (aligned) {
    fxBias = eurNet >= NET_THRESHOLD && usdNet <= -NET_THRESHOLD ? 'up' :
      eurNet <= -NET_THRESHOLD && usdNet >= NET_THRESHOLD ? 'down' : 'mixed';
  }
  // 0 = all twelve FX crosses lean against 6E; 100 = all lean with 6E.
  // This is a breadth balance, never a chance of price movement or a trade outcome.
  const fxBalancePercent = aligned
    ? Math.round(100 * (eur.rising + usd.falling + (eur.neutral + usd.neutral) / 2) / 12)
    : null;

  const sentAt = Date.parse(ninja?.snapshot?.sentAt);
  const ninjaLive = ninja?.status === 'live' && Number.isFinite(sentAt) &&
    now >= sentAt && now - sentAt < 20_000 &&
    /^6E(?:\s|[FGHJKMNQUVXZ]|$)/i.test(ninja.snapshot.instrument || '');
  // A direct, current-bar price move from 6E. It is not a probability or a forecast.
  const sixEChangePercent = ninjaLive && Number.isFinite(ninja.snapshot.open) && ninja.snapshot.open > 0 &&
    Number.isFinite(ninja.snapshot.price) && ninja.snapshot.price > 0
    ? (ninja.snapshot.price / ninja.snapshot.open - 1) * 100 : null;
  const sixEDirection = sixEChangePercent === null ? 'unavailable' :
    sixEChangePercent > 0 ? 'up' : sixEChangePercent < 0 ? 'down' : 'flat';
  const intermarketLive = ['GC', 'CL'].filter(root => {
    const quote = intermarket?.quotes?.[root];
    const asOf = Date.parse(quote?.asOf);
    return quote?.status === 'live' && Number.isFinite(quote.price) &&
      Number.isFinite(asOf) && now >= asOf && now - asOf < 20_000;
  });

  return {
    fxBias,
    fxReady: Boolean(aligned),
    fxBalancePercent,
    alignmentBasis: aligned ? 12 : 0,
    eur: aligned ? { rising: eur.rising, neutral: eur.neutral, falling: eur.falling, net: eurNet } : null,
    usd: aligned ? { rising: usd.rising, neutral: usd.neutral, falling: usd.falling, net: usdNet } : null,
    ninjaLive,
    sixEChangePercent,
    sixEDirection,
    ratesDaily: rates?.status === 'daily' && Boolean(rates?.spread),
    intermarketLive,
    bookmap: 'blocked',
    // No calibrated historical model or verified execution trigger exists yet.
    probability: null,
    entrySignal: false,
  };
}
