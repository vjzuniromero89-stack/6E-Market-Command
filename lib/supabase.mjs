function configuration(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY?.trim();
  if (!url?.startsWith('https://') || !key) throw Error('Supabase is not configured');
  return { url, key };
}

async function rest(path, { method = 'GET', body, prefer } = {}, env) {
  const { url, key } = configuration(env);
  // Opaque sb_secret_* keys belong only in `apikey`; unlike legacy
  // service_role JWTs, they are not bearer tokens.
  const legacyAuthorization = key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` };
  const response = await fetch(`${url}/rest/v1/${path}`, { method, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8000),
    headers: { apikey: key, ...legacyAuthorization, 'Content-Type': 'application/json', Accept: 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) {
    let detail = '';
    try {
      const error = await response.json();
      detail = [error.code, error.message].filter(Boolean).join(': ').slice(0, 240);
    } catch {}
    throw Error(`Supabase HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
  }
  if (response.status === 204) return null;
  const text = await response.text(); return text ? JSON.parse(text) : null;
}

export async function readLatest6E(env) {
  const rows = await rest('market_feed_latest?select=payload&instrument=like.6E%25&order=event_at.desc&limit=1', {}, env);
  return rows?.[0]?.payload || null;
}

export async function persistSnapshot(s, env) {
  await Promise.all([
    rest('market_feed_latest?on_conflict=instrument', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {
      instrument:s.instrument, provider:s.provider, contract:s.contract, event_at:s.sentAt, received_at:s.receivedAt,
      price:s.price, bar_open:s.open, bar_high:s.high, bar_low:s.low, bar_close:s.close,
      bar_volume:s.barVolume, bid_volume:s.bidVolume, ask_volume:s.askVolume, bar_delta:s.barDelta,
      cumulative_delta:s.cumulativeDelta, delta_percent:s.deltaPercent, timeframe:'chart', source:s.source,
      status:'live', observed_at:s.sentAt, latency_ms:s.latencyMs, payload:s
    } }, env),
    rest('market_bars?on_conflict=instrument%2Cbar_time%2Ctimeframe', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {
      instrument:s.instrument, provider:s.provider, contract:s.contract, timeframe:'chart', bar_time:s.barTimeUtc,
      open:s.open, high:s.high, low:s.low, close:s.close, volume:s.barVolume, bid_volume:s.bidVolume,
      ask_volume:s.askVolume, bar_delta:s.barDelta, cumulative_delta:s.cumulativeDelta, delta:s.barDelta,
      delta_percent:s.deltaPercent, source:s.source, received_at:s.receivedAt, payload:s
    } }, env),
    rest('orderflow_snapshots', { method: 'POST', prefer: 'return=minimal', body: {
      instrument:s.instrument, provider:s.provider, contract:s.contract, event_at:s.sentAt, received_at:s.receivedAt,
      observed_at:s.sentAt, bar_time:s.barTimeUtc, price:s.price, total_volume:s.barVolume,
      bid_volume:s.bidVolume, ask_volume:s.askVolume, bar_delta:s.barDelta, cumulative_delta:s.cumulativeDelta,
      delta_percent:s.deltaPercent, source:s.source, payload:s,
      raw_metrics:{ trades:s.trades, maxPositiveDelta:s.maxPositiveDelta, maxNegativeDelta:s.maxNegativeDelta, maxSeenDelta:s.maxSeenDelta, minSeenDelta:s.minSeenDelta, deltaSinceHigh:s.deltaSinceHigh, deltaSinceLow:s.deltaSinceLow }
    } }, env),
    rest('data_sources?on_conflict=source_key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {
      source_key:'ninjatrader_6e', provider:s.provider, instrument:s.instrument, status:'live',
      last_event_at:s.sentAt, last_received_at:s.receivedAt, last_seen_at:s.sentAt,
      latency_ms:s.latencyMs, metadata:{ contract:s.contract, timeframe:'chart' }, updated_at:s.receivedAt
    } }, env),
  ]);
}
