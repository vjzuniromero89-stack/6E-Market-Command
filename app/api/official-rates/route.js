import { authorized } from '../../../lib/feed.mjs';
import { officialRates } from '../../../lib/official-rates.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request) {
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) return Response.json({ error: 'Clave de lectura incorrecta.' }, { status: 401, headers });
  return Response.json(await officialRates(), { headers });
}
