import { authorized } from '../../../lib/feed.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request){
 if(!authorized(request,process.env.DASHBOARD_READ_TOKEN))return Response.json({error:'Unauthorized'},{status:401});
 return Response.json({
  architectureVersion:2,
  feeds:{
   cme:{status:process.env.CME_CLIENT_ID?'configured':'not_configured',purpose:'6E top-of-book/trades/statistics; direct CME WebSocket'},
   rithmic:{status:process.env.RITHMIC_USER?'configured':'not_configured',purpose:'depth/ticks/history/order routing when licensed'},
   rates:{status:process.env.RATES_PROVIDER_KEY?'configured':'not_configured',purpose:'US/DE yields and rate impulse'},
   macro:{status:process.env.MACRO_PROVIDER_KEY?'configured':'not_configured',purpose:'economic calendar, releases, central-bank context'},
   tradingview:{status:process.env.NEXT_PUBLIC_TV_CHARTS_ENABLED==='true'?'library_enabled':'fallback_chart',purpose:'chart UI only; market data remains ours'}
  },
  requiredSymbols:['6E','DXY','EUR/USD','EUR/GBP','EUR/JPY','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD','US2Y','DE2Y','US10Y','DE10Y','GC','ES','VIX','CL'],
  rule:'No synthetic LIVE labels: every module reports provider, timestamp, freshness and coverage.'
 });
}
