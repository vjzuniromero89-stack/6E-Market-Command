const NET_THRESHOLD = 2;

// This is a descriptive FX breadth assessment, not a probability or an entry signal.
// EUR/USD is removed from both baskets so its movement cannot vote twice.
export function evaluateGeneralEngine({ strength, market, ninja, rates, intermarket, now = Date.now() } = {}) {
  const eur = strength?.EUR_EX_USD;
  const usd = strength?.USD_EX_EUR;
  const aligned = market?.source === 'MT5 / FOREX.com' && market?.mode === 'live' &&
    eur?.count === 6 && usd?.count === 6 &&
    eur.asOf && eur.asOf === usd.asOf && eur.reference === usd.reference && eur.period === usd.period;
  const eurNet = aligned ? eur.rising - eur.falling : null;
  const usdNet = aligned ? usd.rising - usd.falling : null;
  let fxBias = 'unavailable';
  if (aligned) {
    fxBias = eurNet >= NET_THRESHOLD && usdNet <= -NET_THRESHOLD ? 'up' :
      eurNet <= -NET_THRESHOLD && usdNet >= NET_THRESHOLD ? 'down' : 'mixed';
  }

  const sentAt = Date.parse(ninja?.snapshot?.sentAt);
  const ninjaLive = ninja?.status === 'live' && Number.isFinite(sentAt) &&
    now >= sentAt && now - sentAt < 20_000 &&
    /^6E(?:\s|[FGHJKMNQUVXZ]|$)/i.test(ninja.snapshot.instrument || '');
  const intermarketLive = ['GC', 'CL'].filter(root => {
    const quote = intermarket?.quotes?.[root];
    const asOf = Date.parse(quote?.asOf);
    return quote?.status === 'live' && Number.isFinite(quote.price) &&
      Number.isFinite(asOf) && now >= asOf && now - asOf < 20_000;
  });

  return {
    fxBias,
    fxReady: Boolean(aligned),
    eur: aligned ? { rising: eur.rising, neutral: eur.neutral, falling: eur.falling, net: eurNet } : null,
    usd: aligned ? { rising: usd.rising, neutral: usd.neutral, falling: usd.falling, net: usdNet } : null,
    ninjaLive,
    ratesDaily: rates?.status === 'daily' && Boolean(rates?.spread),
    intermarketLive,
    bookmap: 'blocked',
    // No calibrated historical model or verified execution trigger exists yet.
    probability: null,
    entrySignal: false,
  };
}
