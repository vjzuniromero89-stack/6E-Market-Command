const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n);
const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
const zsign=(v,dead=0.01)=>!finite(v)?0:v>dead?1:v<-dead?-1:0;
export const EUR_PAIRS=['EUR/USD','EUR/GBP','EUR/JPY','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD'];
export const USD_PAIRS=['EUR/USD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD'];
export const USD_EX_EUR=['GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD'];
const oriented=(q,currency,period)=>{const c=q?.changes?.[period]; if(!finite(c))return null; const [base,quote]=q.symbol.split('/'); return base===currency?c:quote===currency?-c:null};
export function breadth(quotes,currency,pairs,period='1h'){
 const vals=pairs.map(s=>oriented(quotes.find(q=>q.symbol===s),currency,period)).filter(finite);
 if(!vals.length)return null; const mean=avg(vals), signs=vals.map(v=>zsign(v));
 return {score:Math.round(clamp(50+mean*120)),meanChange:mean,rising:signs.filter(x=>x>0).length,falling:signs.filter(x=>x<0).length,neutral:signs.filter(x=>x===0).length,coverage:vals.length,total:pairs.length};
}
export function ratesEngine(market={}){
 const us2=market.US2Y?.value,de2=market.DE2Y?.value;
 if(!finite(us2)||!finite(de2)) return {status:'missing',spread:null,impulse:null};
 const spread=us2-de2, impulse=(market.US2Y?.changeBp||0)-(market.DE2Y?.changeBp||0);
 return {status:'live',spread,impulse,eurPressure:impulse<0?'supportive':impulse>0?'negative':'neutral'};
}
export function buildIntelligence({quotes=[],period='1h',market={},flow=null}={}){
 const eur=breadth(quotes,'EUR',EUR_PAIRS,period), usd=breadth(quotes,'USD',USD_PAIRS,period), usdExEur=breadth(quotes,'USD',USD_EX_EUR,period), rates=ratesEngine(market);
 const diff=eur&&usd?eur.score-usd.score:null;
 const evidence=[]; if(diff!=null)evidence.push({key:'relative',label:'EUR − USD',value:diff,dir:Math.sign(diff),weight:3});
 if(usdExEur)evidence.push({key:'usdexeur',label:'USD ex-EUR',value:usdExEur.score,dir:usdExEur.score>55?-1:usdExEur.score<45?1:0,weight:3});
 if(rates.status==='live')evidence.push({key:'rates',label:'US2Y − DE2Y impulse',value:rates.impulse,dir:rates.impulse<0?1:rates.impulse>0?-1:0,weight:4});
 if(flow?.barDelta!=null)evidence.push({key:'flow',label:'6E bar delta',value:flow.barDelta,dir:Math.sign(flow.barDelta),weight:2});
 const active=evidence.filter(e=>e.dir), raw=active.reduce((s,e)=>s+e.dir*e.weight,0), max=active.reduce((s,e)=>s+e.weight,0);
 const confidence=max?Math.round(Math.abs(raw)/max*100):0; const direction=raw>0?'EUR bullish evidence':raw<0?'EUR bearish evidence':'mixed / insufficient';
 const conflicts=active.length>1 && active.some(e=>e.dir!==Math.sign(raw));
 return {eur,usd,usdExEur,rates,differential:diff,direction,confidence,conflicts,evidence,disclaimer:'Evidence engine, not a prediction or trade instruction.'};
}
