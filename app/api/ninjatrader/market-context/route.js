import { authorized } from '../../../lib/feed.mjs';
import { marketContext } from '../../../lib/market-context.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) {
    return Response.json({ error: 'Clave de lectura incorrecta o no configurada.' }, { status: 401, headers });
  }
  const body = await marketContext();
  return Response.json(body, { status: body.status === 'unavailable' ? 503 : 200, headers });
}
