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
    {state?.error&&<p>{state.error}</p>}
    {state?.results&&<div>{Object.entries(state.results).map(([term,items])=><div key={term}><b>{term}</b><span>{items.length?items.map(x=>`${x.symbol} — ${x.name}${x.access?' ['+x.access+']':''}`).join(' | '):'Sin resultados'}</span></div>)}</div>}
  </section>;
}
