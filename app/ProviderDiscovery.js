'use client';
import { useState } from 'react';

export default function ProviderDiscovery({token}) {
  const [state,setState]=useState(null), [loading,setLoading]=useState(false);
  async function run(){
    if(!token||loading)return; setLoading(true); setState(null);
    try{const response=await fetch('/api/provider-discovery',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});setState(await response.json());}
    catch{setState({error:'No se pudo consultar el catálogo.'});}finally{setLoading(false);}
  }
  return <section className="provider-discovery"><button onClick={run} disabled={!token||loading}>{loading?'Consultando…':'Comprobar DXY y tasas'}</button>
    <p>Consulta manual del catálogo y US2Y: hasta 7 créditos de Twelve Data por pulsación. No conecta datos al motor.</p>
    {state?.error&&<p>{state.error}</p>}
    {state?.results&&<div><p>Coincidencias exactas del catálogo; aparecer allí no confirma una cotización.</p>{Object.entries(state.results).map(([term,items])=><div key={term}><b>{term}</b><span>{items.length?items.map(x=>`${x.symbol} — ${x.name}${x.access?' ['+x.access+']':''}`).join(' | '):'Sin símbolo exacto'}</span></div>)}
      <div><b>DXY índices</b><span>{state.dollarIndex?.status==='catalog_checked'?(state.dollarIndex.candidates.length?state.dollarIndex.candidates.map(x=>`${x.symbol} — ${x.name}${x.access?' ['+x.access+']':''}`).join(' | ')+' · Candidatos sin verificar.':'Sin candidato al buscar US Dollar Index.'):'No se pudo ampliar la búsqueda del índice.'}</span></div>
      <div><b>US2Y precio</b><span>{state.us2yQuote?.status==='quote_received'?`Twelve Data devolvió ${state.us2yQuote.value}; última actualización ${new Date(state.us2yQuote.lastUpdatedAt).toLocaleString()}. Solo diagnóstico, no integrado.`:state.us2yQuote?.status==='timestamp_unverified'?`Devolvió ${state.us2yQuote.value}, pero sin fecha de actualización verificable. No integrado.`:state.us2yQuote?.status==='symbol_not_found'?'No se encontró US2Y exacto.':'No se obtuvo una cotización verificable con esta clave.'}</span></div>
      <div><b>DE 2Y bonos</b><span>{state.germanBonds?.status==='catalog_checked'?(state.germanBonds.candidates.length?state.germanBonds.candidates.map(x=>`${x.symbol} — ${x.name}${x.access?' ['+x.access+']':''}`).join(' | '):`Sin candidato en ${state.germanBonds.searched} registros revisados`)+(state.germanBonds.mayHaveMore?' · Hay más páginas sin revisar.':'')+' · Ninguno integrado.':'No se pudo consultar el catálogo alemán.'}</span></div>
    </div>}
  </section>;
}
