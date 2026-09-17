'use client';
import { useEffect, useState } from 'react';

export default function useMarketContext(token) {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setData(null);
    if (!token) return;
    let stopped = false, timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/market-context', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) });
        const body = await response.json();
        if (!stopped) setData(body.quotes ? body : null);
      } catch { if (!stopped) setData(null); }
      if (!stopped) timer = setTimeout(poll, 60000);
    }
    poll();
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, [token]);
  const expired = !data?.fetchedAt || now - Date.parse(data.fetchedAt) > 30 * 60000 ||
    data.quotes?.some(q => q.status === 'fresh' && now - Date.parse(q.asOf) > 30 * 60000);
  return { data: token ? data : null, strength: token && !expired ? data?.strengths : null, now };
}

