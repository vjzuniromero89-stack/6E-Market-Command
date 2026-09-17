import { authorized, validateSnapshot, redis, feedKey } from '../../../lib/feed.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' },
});

export async function GET(request) {
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) return json({ error: 'Clave de lectura incorrecta o no configurada.' }, 401);
  try {
    const stored = await redis(['GET', feedKey()]);
    if (!stored) return json({ status: 'waiting', snapshot: null });
    const snapshot = JSON.parse(stored);
    const age = Date.now() - Date.parse(snapshot.sentAt);
    return json({ status: age >= -5000 && age < 20000 ? 'live' : 'stale', snapshot });
  } catch {
    return json({ error: 'Configura o revisa la conexión de almacenamiento en Vercel.' }, 503);
  }
}

export async function POST(request) {
  if (!authorized(request, process.env.NINJATRADER_INGEST_TOKEN)) return json({ error: 'Unauthorized' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON' }, 415);
  let snapshot;
  try {
    if (!request.body) throw Error('Empty body');
    const reader = request.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return json({ error: 'Payload too large' }, 413); }
      chunks.push(Buffer.from(value));
    }
    snapshot = validateSnapshot(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return json({ error: 'Invalid snapshot or Windows clock out of sync' }, 400);
  }
  try {
    // Atomic: an older request must never overwrite a newer observation.
    const script = "local old=redis.call('GET',KEYS[1]); if old and cjson.decode(old).sentAt >= ARGV[2] then return 0 end; redis.call('SET',KEYS[1],ARGV[1],'EX',120); return 1";
    await redis(['EVAL', script, 1, feedKey(), JSON.stringify(snapshot), snapshot.sentAt]);
    return json({ ok: true });
  } catch {
    return json({ error: 'Storage unavailable' }, 503);
  }
}
