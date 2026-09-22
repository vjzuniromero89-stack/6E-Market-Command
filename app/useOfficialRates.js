'use client';
import { useEffect, useState } from 'react';

export default function useOfficialRates(token) {
  const [rates, setRates] = useState(null);
  useEffect(() => {
    setRates(null);
    if (!token) return;
    let stopped = false;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/official-rates', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        const body = await response.json();
        if (!stopped) setRates(response.ok ? body : null);
      } catch { if (!stopped) setRates(null); }
    }
    poll();
    const timer = setInterval(poll, 30 * 60 * 1000);
    return () => { stopped = true; controller.abort(); clearInterval(timer); };
  }, [token]);
  return rates;
}
