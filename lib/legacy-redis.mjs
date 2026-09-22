// Legacy storage used only by optional MT5/Twelve Data modules. NinjaTrader never imports this module.
export async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw Error('Legacy storage not configured');
  const response = await fetch(url, { method:'POST', cache:'no-store', redirect:'error', signal:AbortSignal.timeout(5000), headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify(command) });
  if (!response.ok) throw Error('Legacy storage unavailable');
  const body = await response.json(); if (body.error) throw Error('Legacy storage command failed'); return body.result;
}
