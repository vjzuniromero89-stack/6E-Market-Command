import { authorized, feedStatus, validateSnapshot } from '../../../lib/feed.mjs';
import { persistSnapshot, readLatest6E } from '../../../lib/supabase.mjs';
import { unavailableEngines } from '../../../lib/engines.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' } });

export async function GET(request) {
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) return json({ error:'Clave de lectura incorrecta o no configurada.' }, 401);
  try {
    const snapshot = await readLatest6E();
    return json({ ...feedStatus(snapshot), provider:snapshot?.provider || 'CME via NinjaTrader 8', snapshot, engines:unavailableEngines() });
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : 'Unknown Supabase error';
    return json({ error:`Supabase: ${diagnostic}`, status:'unavailable', snapshot:null }, 503);
  }
}

export async function POST(request) {
  if (!authorized(request, process.env.NINJATRADER_INGEST_TOKEN)) return json({ error:'Unauthorized' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error:'Expected JSON' }, 415);
  let text;
  try { text = await request.text(); } catch { return json({ error:'Invalid body' }, 400); }
  if (new TextEncoder().encode(text).byteLength > 16_384) return json({ error:'Payload too large' }, 413);
  let snapshot;
  try { snapshot = validateSnapshot(JSON.parse(text)); } catch (error) { return json({ error:error.message }, 400); }
  try { await persistSnapshot(snapshot); return json({ ok:true, receivedAt:snapshot.receivedAt, latencyMs:snapshot.latencyMs }); }
  catch (error) { return json({ error:`Supabase write unavailable: ${error instanceof Error ? error.message : 'unknown error'}` }, 503); }
}
