import { authorized } from '../../../lib/feed.mjs';
import { INTERMARKET_ROOTS, presentIntermarket, validateIntermarketSnapshot } from '../../../lib/intermarket.mjs';
import { persistIntermarketSnapshot, readLatestIntermarket } from '../../../lib/supabase.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const json = (body, status = 200) => Response.json(body, { status, headers });

export async function GET(request) {
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) return json({ error: 'Clave de lectura incorrecta.' }, 401);
  try {
    const snapshots = await readLatestIntermarket();
    const now = Date.now();
    return json({ source: 'NinjaTrader futures data', quotes: Object.fromEntries(INTERMARKET_ROOTS.map(root =>
      [root, presentIntermarket(snapshots[root], root, now)])) });
  } catch (error) {
    return json({ error: `Supabase: ${error instanceof Error ? error.message : 'unavailable'}` }, 503);
  }
}

export async function POST(request) {
  // Keep GC/CL credentials independent of the already-working 6E connector.
  // Existing installations can still use the 6E key until a dedicated key is set.
  const ingestToken = process.env.INTERMARKET_INGEST_TOKEN || process.env.NINJATRADER_INGEST_TOKEN;
  if (!authorized(request, ingestToken)) return json({ error: 'Unauthorized' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON' }, 415);
  let body;
  try { body = await request.text(); } catch { return json({ error: 'Invalid body' }, 400); }
  if (new TextEncoder().encode(body).byteLength > 8_192) return json({ error: 'Payload too large' }, 413);
  let snapshot;
  try { snapshot = validateIntermarketSnapshot(JSON.parse(body)); }
  catch (error) { return json({ error: error.message }, 400); }
  try {
    await persistIntermarketSnapshot(snapshot);
    return json({ ok: true, instrument: snapshot.instrument, receivedAt: snapshot.receivedAt });
  } catch (error) {
    return json({ error: `Supabase write unavailable: ${error instanceof Error ? error.message : 'unknown error'}` }, 503);
  }
}
