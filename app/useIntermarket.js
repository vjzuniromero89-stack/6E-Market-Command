'use client';
import { useEffect, useState } from 'react';

export default function useIntermarket(token) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    if (!token) return;
    let stopped = false;
    let timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/intermarket', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        const body = await response.json();
        if (!stopped) setData(response.ok ? body : null);
      } catch { if (!stopped) setData(null); }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [token]);
  return data;
}
