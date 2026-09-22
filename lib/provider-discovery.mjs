export const DISCOVERY_TERMS = ['DXY','US2Y','US10Y','DE2Y'];

const safeText = value => typeof value === 'string' ? value.slice(0,120) : null;

async function providerJson(path, params, apiKey, fetcher) {
  const url = new URL(path, 'https://api.twelvedata.com');
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,String(value));
  url.searchParams.set('apikey',apiKey);
  const response = await fetcher(url, { cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(10000) });
  if (response.status >= 300 && response.status < 400) throw Error('Twelve Data redirigió la consulta; revisa el servicio.');
  if (!response.ok) throw Error(`Twelve Data no responde (HTTP ${response.status}).`);
  const body = await response.json();
  if (body?.status === 'error') throw Error('Twelve Data rechazó la consulta; revisa la clave y los créditos disponibles.');
  return body;
}

function utcTime(value) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ','T')+'Z' : value;
  const time = Date.parse(normalized);
  return Number.isFinite(time) && time <= Date.now()+300000 ? new Date(time).toISOString() : null;
}

const germanTwoYear = name => /(?:\b2\s*[- ]?\s*(?:years?|yrs?|y)\b|\btwo[- ]?years?\b)/i.test(name)
  && /(?:yield|government|treasury|bund|german)/i.test(name);

export async function discoverTwelveData(apiKey = process.env.TWELVE_DATA_API_KEY, fetcher = fetch) {
  if (!apiKey || apiKey.length < 8) throw Error('Twelve Data no configurado');
  const results = {};
  for (const term of DISCOVERY_TERMS) {
    const body = await providerJson('/symbol_search',{symbol:term,outputsize:8,show_plan:true},apiKey,fetcher);
    results[term] = (Array.isArray(body?.data) ? body.data : []).slice(0,8).map(item => ({
      symbol:safeText(item.symbol), name:safeText(item.instrument_name), exchange:safeText(item.exchange),
      type:safeText(item.instrument_type), country:safeText(item.country), access:safeText(item.access?.plan || item.access?.global),
    })).filter(item => item.symbol?.toUpperCase() === term && item.name);
  }
  let dollarIndex;
  try {
    const body = await providerJson('/symbol_search',{symbol:'US Dollar Index',outputsize:15,show_plan:true},apiKey,fetcher);
    dollarIndex = {status:'catalog_checked',candidates:(Array.isArray(body?.data)?body.data:[]).slice(0,15).map(item=>({
      symbol:safeText(item.symbol),name:safeText(item.instrument_name),type:safeText(item.instrument_type),access:safeText(item.access?.plan || item.access?.global),
    })).filter(item=>item.symbol && /(?:US|U\.S\.|United States)\s+Dollar\s+Index/i.test(item.name||'') && /index/i.test(item.type||''))};
  } catch { dollarIndex = {status:'catalog_unavailable'}; }
  let germanBonds;
  try {
    const body = await providerJson('/bonds',{country:'Germany',outputsize:100,page:1,show_plan:true},apiKey,fetcher);
    if (!Array.isArray(body?.result?.list)) throw Error('Catálogo de bonos no disponible');
    const list = body.result.list;
    germanBonds = {
      status:'catalog_checked', searched:list.length, mayHaveMore:Number(body.result.count)>list.length,
      candidates:list.filter(item=>typeof item.name==='string' && germanTwoYear(item.name)).slice(0,12).map(item=>({
        symbol:safeText(item.symbol),name:safeText(item.name),country:safeText(item.country),access:safeText(item.access?.plan || item.access?.global),
      })).filter(item=>item.symbol && item.name),
    };
  } catch { germanBonds = {status:'catalog_unavailable'}; }
  let us2yQuote = {status:'symbol_not_found'};
  if (results.US2Y.length) {
    try {
      const body = await providerJson('/quote',{symbol:'US2Y'},apiKey,fetcher);
      const value = Number(body?.close);
      const lastUpdatedAt = utcTime(body?.last_update_at);
      const barAt = Number.isInteger(body?.timestamp) && body.timestamp>0 && body.timestamp*1000<=Date.now()+300000
        ? utcTime(new Date(body.timestamp*1000).toISOString()) : null;
      us2yQuote = Number.isFinite(value) && value>0 && (!body?.symbol || body.symbol.toUpperCase()==='US2Y')
        ? {status:lastUpdatedAt?'quote_received':'timestamp_unverified',value,lastUpdatedAt,barAt}
        : {status:'quote_unavailable'};
    } catch { us2yQuote = {status:'quote_unavailable'}; }
  }
  return { provider:'Twelve Data', checkedAt:new Date().toISOString(), results, dollarIndex, germanBonds, us2yQuote };
}
