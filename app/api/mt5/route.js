import { authorized, redis } from '../../../lib/feed.mjs';
import { validateMT5, mt5Key, STORE_MT5 } from '../../../lib/mt5.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
export async function POST(request) {
  const secret = process.env.MT5_INGEST_TOKEN;
  if (!secret || secret === process.env.DASHBOARD_READ_TOKEN || secret === process.env.NINJATRADER_INGEST_TOKEN || !authorized(request, secret)) return json({ error: 'Unauthorized or invalid token configuration' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON' }, 415);
  let snapshot;
  try {
    if (!request.body) throw Error('Empty');
    const reader = request.body.getReader(), chunks = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return json({ error: 'Payload too large' }, 413); }
      chunks.push(Buffer.from(value));
    }
    snapshot = validateMT5(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch { return json({ error: 'Invalid FX snapshot or Windows clock' }, 400); }
  try {
    const result = await redis(['EVAL', STORE_MT5, 1, mt5Key(), JSON.stringify(snapshot), snapshot.sentAt, snapshot.receivedAt]);
    return result === 2 ? json({ error: 'Send at most once per second' }, 429) : json({ ok: true, accepted: result === 1 });
  } catch { return json({ error: 'Storage unavailable' }, 503); }
}
