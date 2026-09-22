import { authorized } from '../../../lib/feed.mjs';
import { discoverTwelveData } from '../../../lib/provider-discovery.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' };

export async function GET(request) {
  if (!authorized(request, process.env.DASHBOARD_READ_TOKEN)) return Response.json({error:'Clave de lectura incorrecta.'},{status:401,headers});
  try { return Response.json(await discoverTwelveData(),{headers}); }
  catch (error) { return Response.json({error:error instanceof Error ? error.message : 'Consulta no disponible'},{status:503,headers}); }
}
