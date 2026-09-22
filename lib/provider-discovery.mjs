export const DISCOVERY_TERMS = ['DXY','US2Y','US10Y','DE2Y'];

const safeText = value => typeof value === 'string' ? value.slice(0,120) : null;

export async function discoverTwelveData(apiKey = process.env.TWELVE_DATA_API_KEY, fetcher = fetch) {
  if (!apiKey || apiKey.length < 8) throw Error('Twelve Data no configurado');
  const results = {};
  for (const term of DISCOVERY_TERMS) {
    const url = new URL('https://api.twelvedata.com/symbol_search');
    url.searchParams.set('symbol', term);
    url.searchParams.set('outputsize', '8');
    url.searchParams.set('show_plan', 'true');
    url.searchParams.set('apikey', apiKey);
    const response = await fetcher(url, { cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(10000) });
    if (response.status >= 300 && response.status < 400) throw Error('Twelve Data redirigió la consulta; revisa el servicio.');
    if (!response.ok) throw Error(`Twelve Data no responde (HTTP ${response.status}).`);
    const body = await response.json();
    if (body?.status === 'error') throw Error('Twelve Data rechazó la consulta; revisa la clave y los créditos disponibles.');
    results[term] = (Array.isArray(body?.data) ? body.data : []).slice(0,8).map(item => ({
      symbol:safeText(item.symbol), name:safeText(item.instrument_name), exchange:safeText(item.exchange),
      type:safeText(item.instrument_type), country:safeText(item.country), access:safeText(item.access?.plan || item.access?.global),
    })).filter(item => item.symbol?.toUpperCase() === term && item.name);
  }
  return { provider:'Twelve Data', checkedAt:new Date().toISOString(), results };
}
