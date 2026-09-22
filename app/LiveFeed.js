'use client';
import { useEffect, useState } from 'react';

const format = value => typeof value === 'number' ? value.toLocaleString('en-US') : '—';
export default function LiveFeed({ onTokenChange = () => {}, onFeedChange = () => {} }) {
  const [key, setKey] = useState('');
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Introduce tu clave de lectura para conectar.');
  const [now, setNow] = useState(0);
  useEffect(() => { onFeedChange(result); }, [result, onFeedChange]);
  useEffect(() => {
    const saved = sessionStorage.getItem('market-command-read-token');
    if (saved) { setToken(saved); onTokenChange(saved); setMessage('Restaurando conexión…'); }
  }, [onTokenChange]);
  useEffect(() => {
    if (!token) return;
    let stopped = false, timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/ninjatrader', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'No se pudo conectar.');
        if (!stopped) { setResult(data); setMessage(''); setNow(Date.now()); }
      } catch (error) {
        if (!stopped) { setResult(null); setMessage(error.name === 'TypeError' ? 'Sin conexión con la web.' : error.message); }
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    poll();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(clock); controller.abort(); };
  }, [token]);
  const snapshot = result?.snapshot;
  const age = snapshot ? Math.max(0, Math.floor((now - Date.parse(snapshot.sentAt)) / 1000)) : null;
  const live = result?.status === 'live' && age !== null && age < 20;
  const latency = snapshot?.latencyMs ?? null;
  return <section className="livefeed card" aria-label="Conexión NinjaTrader">
    <div className="ct"><div><b>NINJATRADER · 6E</b><span>Lectura del gráfico volumétrico · actualización cada 5 segundos</span></div><span className={'pill ' + (live ? 'green' : 'red')}>{live ? 'RECIBIENDO DATOS' : snapshot ? 'DATOS ANTIGUOS' : 'SIN CONEXIÓN'}</span></div>
    {!token ? <form className="connectform" onSubmit={event => { event.preventDefault(); const next = key.trim(); sessionStorage.setItem('market-command-read-token', next); setToken(next); onTokenChange(next); setKey(''); }}>
      <label htmlFor="readkey">Clave privada de lectura</label>
      <input id="readkey" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} minLength={32} required />
      <button type="submit">Conectar</button>
    </form> : <div className="feedmeta"><span>{snapshot?.instrument || 'Esperando NinjaTrader…'}</span><button onClick={() => { sessionStorage.removeItem('market-command-read-token'); setToken(''); onTokenChange(''); setResult(null); setMessage('Conexión cerrada.'); }}>Desconectar</button></div>}
    <p className="feedmessage" role="status">{message || (snapshot ? `Proveedor: ${snapshot.provider} · freshness ${age} s · latencia ${latency ?? '—'} ms · barra ${snapshot.barTimeLocal || snapshot.barTimeUtc}` : 'Esperando el primer envío. Abre el gráfico con el conector activado.')}</p>
    <div className="flowgrid">
      <div><span>PRECIO 6E</span><b>{snapshot ? snapshot.price.toFixed(5) : '—'}</b></div>
      <div><span>OHLC</span><b>{snapshot ? `${snapshot.open.toFixed(5)} / ${snapshot.high.toFixed(5)} / ${snapshot.low.toFixed(5)} / ${snapshot.close.toFixed(5)}` : '—'}</b></div>
      <div><span>VOLUMEN DE BARRA</span><b>{format(snapshot?.barVolume)}</b></div>
      <div><span>BID / ASK VOL</span><b>{snapshot ? `${format(snapshot.bidVolume)} / ${format(snapshot.askVolume)}` : '—'}</b></div>
      <div><span>DELTA DE BARRA</span><b>{format(snapshot?.barDelta)}</b></div>
      <div><span>DELTA ACUMULADO</span><b>{format(snapshot?.cumulativeDelta)}</b></div>
      <div><span>DELTA %</span><b>{typeof snapshot?.deltaPercent === 'number' ? `${snapshot.deltaPercent.toFixed(1)}%` : '—'}</b></div>
      <div><span>TRADES</span><b>{format(snapshot?.trades)}</b></div>
    </div>
    <p className="feedmessage">{live ? 'Feed reciente almacenado en Supabase.' : 'No hay confirmación de datos actuales.'} DXY y tasas se verifican por separado; Rithmic permanece UNAVAILABLE hasta conectar un proveedor verificable. Nunca se sustituyen por datos LIVE inventados.</p>
  </section>;
}
