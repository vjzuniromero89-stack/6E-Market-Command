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

export async function readLatestFX(env) {
  const rows = await rest('market_feed_latest?select=payload&instrument=eq.FX_CONTEXT&limit=1', {}, env);
  return rows?.[0]?.payload || null;
}

export async function readLatestIntermarket(env) {
  const roots = ['GC', 'CL'];
  const rows = await Promise.all(roots.map(root =>
    rest(`market_feed_latest?select=payload&instrument=like.${root}%25&order=event_at.desc&limit=1`, {}, env)));
  return Object.fromEntries(roots.map((root, index) => [root, rows[index]?.[0]?.payload || null]));
}

export async function persistIntermarketSnapshot(snapshot, env) {
  await Promise.all([
    rest('market_feed_latest?on_conflict=instrument', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {
      instrument: snapshot.instrument, provider: snapshot.provider, contract: snapshot.instrument,
      event_at: snapshot.sentAt, received_at: snapshot.receivedAt, observed_at: snapshot.sentAt,
      price: snapshot.price, bar_open: snapshot.open, bar_high: snapshot.high,
      bar_low: snapshot.low, bar_close: snapshot.close, timeframe: 'chart',
      source: snapshot.source, status: 'live', latency_ms: snapshot.latencyMs, payload: snapshot,
    } }, env),
    rest('data_sources?on_conflict=source_key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {
      source_key: `ninjatrader_intermarket_${snapshot.root.toLowerCase()}`,
      provider: snapshot.provider, instrument: snapshot.instrument, status: 'live',
      last_event_at: snapshot.sentAt, last_received_at: snapshot.receivedAt,
      last_seen_at: snapshot.sentAt, latency_ms: snapshot.latencyMs,
      metadata: { contract: snapshot.instrument, root: snapshot.root, timeframe: 'chart' },
      updated_at: snapshot.receivedAt,
    } }, env),
  ]);
}

export async function persistFXSnapshot(snapshot, env) {
  const eventAt = new Date(snapshot.sentAt).toISOString();
  const receivedAt = new Date(snapshot.receivedAt).toISOString();
  await Promise.all([
    rest('market_feed_latest?on_conflict=instrument', { method:'POST', prefer:'resolution=merge-duplicates,return=minimal', body:{
      instrument:'FX_CONTEXT', provider:'MT5 / FOREX.com', event_at:eventAt, received_at:receivedAt,
      source:'mt5_forex', status:snapshot.mode === 'live' ? 'live' : 'demo', observed_at:eventAt,
      latency_ms:Math.max(0, snapshot.receivedAt-snapshot.sentAt), payload:snapshot
    } }, env),
    rest('data_sources?on_conflict=source_key', { method:'POST', prefer:'resolution=merge-duplicates,return=minimal', body:{
      source_key:'mt5_fx', provider:'MT5 / FOREX.com', instrument:'FX_CONTEXT',
      status:snapshot.connected ? (snapshot.mode === 'live' ? 'live' : 'demo') : 'offline',
      last_event_at:eventAt, last_received_at:receivedAt, last_seen_at:eventAt,
      latency_ms:Math.max(0, snapshot.receivedAt-snapshot.sentAt), metadata:{ quoteCount:snapshot.quotes.length }, updated_at:receivedAt
    } }, env),
  ]);
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
