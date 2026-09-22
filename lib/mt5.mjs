import { readLatestFX } from './supabase.mjs';
import { PERIODS, calculateStrengths } from './timeframes.mjs';

export const MT5_SYMBOLS = ['EUR/USD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD','EUR/GBP','EUR/JPY','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD'];

export const MT5_MAX_AGE = 10000;
export function targets(sentAt) {
  const minute = Math.floor(sentAt / 60000) * 60000;
  return { '15m': minute - 900000, '1h': minute - 3600000, day: Math.floor(sentAt / 86400000) * 86400000 };
}
const priceOK = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 100000;
function cleanQuote(q, reference, expectedSymbol = null) {
  if (!q || (expectedSymbol !== null && q.symbol !== expectedSymbol) || typeof q.symbol !== 'string' || q.symbol.length > 32) throw Error('Invalid symbol');
  if (q.bid === null && q.ask === null) return { symbol: q.symbol, bid: null, ask: null, tickAt: null, baselines: {} };
  if (!priceOK(q.bid) || !priceOK(q.ask) || q.ask < q.bid || !Number.isSafeInteger(q.tickAt) || q.tickAt <= 0) throw Error('Invalid tick');
  const baselines = {};
  for (const period of PERIODS) {
    const b = q.baselines?.[period];
    if (b == null) continue;
    if (!priceOK(b.price) || b.at !== reference[period]) throw Error('Invalid historical reference');
    baselines[period] = { price: b.price, at: b.at };
  }
  return { symbol: q.symbol, bid: q.bid, ask: q.ask, tickAt: q.tickAt, baselines };
}
export function validateMT5(body, now = Date.now()) {
  if (!body || body.schemaVersion !== 1 || !['live', 'demo'].includes(body.mode)) throw Error('Invalid schema');
  const sent = body.sentAt;
  if (!Number.isSafeInteger(sent) || Math.abs(now - sent) > 15000 || typeof body.connected !== 'boolean') throw Error('Clock or connection');
  if (!Array.isArray(body.quotes) || body.quotes.length !== MT5_SYMBOLS.length) throw Error('Thirteen symbols required');
  const seen = new Set(), reference = targets(sent);
  const quotes = body.quotes.map(q => {
    if (!q || !MT5_SYMBOLS.includes(q.symbol) || seen.has(q.symbol)) throw Error('Invalid symbol');
    seen.add(q.symbol);
    const clean = cleanQuote(q, reference, q.symbol);
    if (clean.tickAt !== null && clean.tickAt > sent + 2000) throw Error('Invalid tick');
    return clean;
  });
  let dxy = null;
  if (body.dxy != null) {
    dxy = cleanQuote(body.dxy, reference);
    if (dxy.tickAt !== null && dxy.tickAt > sent + 2000) throw Error('Invalid DXY tick');
  }
  return { schemaVersion: 1, mode: body.mode, connected: body.connected, sentAt: sent, receivedAt: now, quotes, dxy };
}

function presentQuote(q, snapshot, snapshotFresh, now) {
  const fresh = snapshotFresh && q?.bid != null && now - q.tickAt <= MT5_MAX_AGE && q.tickAt <= now + 2000;
  const changes = {}, references = {};
  for (const period of PERIODS) {
    const b = q?.baselines?.[period];
    const valid = b && b.at === targets(now)[period] && q?.tickAt >= b.at;
    changes[period] = valid ? (q.bid / b.price - 1) * 100 : null;
    references[period] = valid ? new Date(b.at).toISOString() : null;
  }
  return { symbol:q?.symbol || null, price:q?.bid ?? null, bid:q?.bid ?? null, ask:q?.ask ?? null,
    asOf:snapshot ? new Date(snapshot.sentAt).toISOString() : null,
    tickAt:q?.tickAt ? new Date(q.tickAt).toISOString() : null,
    status:q?.bid == null ? 'unavailable' : fresh ? 'fresh' : 'stale', changes, references };
}

export function presentMT5(snapshot, now = Date.now(), reason = null) {
  const snapshotFresh = snapshot?.connected && now - snapshot.sentAt <= MT5_MAX_AGE && snapshot.sentAt <= now + 2000;
  const quotes = MT5_SYMBOLS.map(symbol => {
    const q = snapshot?.quotes?.find(q => q.symbol === symbol);
    return { ...presentQuote(q, snapshot, snapshotFresh, now), symbol };
  });
  return { source: 'MT5 / FOREX.com', mode: snapshot?.mode || null,
    status: quotes.every(q => q.status === 'fresh') ? 'fresh' : quotes.some(q => q.price !== null) ? 'partial_or_stale' : 'unavailable',
    fetchedAt: snapshot ? new Date(snapshot.receivedAt).toISOString() : null,
    refreshSeconds: 1, pollSeconds: 1, maxAgeSeconds: 10,
    reason: reason || (!snapshot ? 'waiting_mt5' : !snapshot.connected ? 'mt5_disconnected' : null), quotes,
    dxy: presentQuote(snapshot?.dxy, snapshot, snapshotFresh, now),
    periods: Object.fromEntries(PERIODS.map(p => [p, calculateStrengths(quotes, p)])) };
}
export async function mt5Context() {
  try {
    return presentMT5(await readLatestFX());
  } catch { return presentMT5(null, Date.now(), 'storage_unavailable'); }
}
