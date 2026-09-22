import { authorized } from '../../../lib/feed.mjs';
import { buildIntelligence } from '../../../lib/intelligence.mjs';
import { mt5Context } from '../../../lib/mt5.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request){
 if(!authorized(request,process.env.DASHBOARD_READ_TOKEN))return Response.json({error:'Unauthorized'},{status:401});
 const url=new URL(request.url),period=url.searchParams.get('period')||'1h';
 try{const fx=await mt5Context(); return Response.json({asOf:new Date().toISOString(),period,engine:buildIntelligence({quotes:fx.quotes||[],period}),providers:{fx:fx.source||'MT5',rates:'not_connected',dxy:'not_connected',cme:'not_connected'}})}catch{return Response.json({error:'Intelligence source unavailable'},{status:503})}
}
