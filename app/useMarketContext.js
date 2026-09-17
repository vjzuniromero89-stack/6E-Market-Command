'use client';
import { useEffect, useState } from 'react';

export default function useMarketContext(token, period = '1h') {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setData(null);
    if (!token) return;
    let stopped = false, timer;
    let pollMs = 1000;
    const controller = new AbortController();
    async function poll() {
      const started = Date.now();
      try {
        const response = await fetch('/api/market-context', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) });
        const body = await response.json();
        if (!stopped) { setData(body.quotes ? body : null); pollMs = body.pollSeconds === 1 ? 1000 : body.source === 'Twelve Data' ? 60000 : 5000; }
      } catch { if (!stopped) { setData(null); pollMs = 5000; } }
      if (!stopped) timer = setTimeout(poll, Math.max(100, pollMs - (Date.now() - started)));
    }
    poll();
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, [token]);
  const dayChanged = period === 'day' && data?.quotes?.some(q => q.asOf && q.asOf.slice(0,10) !== new Date(now || Date.now()).toISOString().slice(0,10));
  const maxAge = (data?.maxAgeSeconds || 1800) * 1000;
  const expired = dayChanged || !data?.fetchedAt || now - Date.parse(data.fetchedAt) > maxAge ||
    data.quotes?.some(q => q.status === 'fresh' && now - Date.parse(q.tickAt || q.asOf) > maxAge);
  return { data: token ? data : null, strength: token && !expired ? data?.periods?.[period] : null, now };
}

