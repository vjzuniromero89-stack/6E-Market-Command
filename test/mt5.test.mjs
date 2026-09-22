import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMT5, presentMT5, targets, MT5_SYMBOLS } from '../lib/mt5.mjs';
import { POST } from '../app/api/mt5/route.js';
import { GET } from '../app/api/market-context/route.js';

const now = Date.parse('2026-09-17T12:00:20Z');
const fixture = (time=now) => ({ schemaVersion:1, sentAt:time, connected:true, mode:'live', quotes:MT5_SYMBOLS.map(symbol=>({symbol,bid:1.2,ask:1.2002,tickAt:time-1000,baselines:Object.fromEntries(Object.entries(targets(time)).map(([p,at])=>[p,{at,price:1.19}]))})) });
const secret='m'.repeat(40), read='r'.repeat(40);
const request=(token,body,headers={})=>new Request('https://test.invalid/api/mt5',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});

test('MT5 validator strips extra account data, rejects malformed prices, duplicate pairs, clocks and reference times',()=>{
  const data=fixture(); data.accountPassword='never-forward'; data.quotes[0].login=123;
  const clean=validateMT5(data,now);
  assert.equal(clean.accountPassword,undefined); assert.equal(clean.quotes[0].login,undefined);
  for(const mutate of [x=>x.sentAt-=16000,x=>x.quotes[0].ask=1,x=>x.quotes[0].tickAt+=5000,x=>x.quotes[1].symbol=x.quotes[0].symbol,x=>x.quotes.pop(),x=>x.quotes[0].baselines['1h'].at-=60000,x=>x.mode='fake',x=>x.quotes[0].bid='1.2']){
    const data=fixture();mutate(data);assert.throws(()=>validateMT5(data,now));
  }
});
test('MT5 prices and strength use BID, show ASK, and do not consume Twelve Data',()=>{
  const result=presentMT5(validateMT5(fixture(),now),now);
  assert.equal(result.source,'MT5 / FOREX.com'); assert.equal(result.pollSeconds,1);
  assert.equal(result.quotes[0].price,1.2); assert.equal(result.quotes[0].ask,1.2002);
  assert.ok(Math.abs(result.quotes[0].changes['1h']-(1.2/1.19-1)*100)<1e-10);
  assert.equal(result.periods['1h'].EUR.score,100); assert.equal(result.periods['1h'].USD.score,43);
  assert.equal(result.periods['1h'].USD_EX_EUR.score,50);
});
test('stale tick cannot be made live by a fresh heartbeat; disconnect and snapshot expiry clear strength',()=>{
  const data=fixture();data.quotes[0].tickAt=now-11000;
  const result=presentMT5(validateMT5(data,now),now);
  assert.equal(result.quotes[0].status,'stale');assert.equal(result.periods['1h'].EUR,null);
  assert.equal(result.periods['1h'].USD,null);
  data.connected=false;assert.equal(presentMT5(validateMT5(data,now),now).periods['15m'].EUR,null);
  assert.equal(presentMT5(validateMT5(fixture(),now),now+11000).periods.day.EUR,null);
});
test('missing symbol/history preserves prices but prevents incomplete strength; demo is explicitly identified',()=>{
  const data=fixture(); data.mode='demo'; data.quotes[0].baselines={};data.quotes[1]={symbol:'GBP/USD',bid:null,ask:null};
  const result=presentMT5(validateMT5(data,now),now);
  assert.equal(result.mode,'demo'); assert.equal(result.quotes[0].price,1.2);
  assert.equal(result.periods['1h'].EUR,null);assert.equal(result.quotes[1].status,'unavailable');
});
test('minute and day rollovers invalidate outdated reference windows',()=>{
  const before=Date.parse('2026-09-17T23:59:59Z');
  const result=presentMT5(validateMT5(fixture(before),before),before+2000);
  assert.equal(result.quotes[0].status,'fresh');assert.equal(result.periods.day.EUR,null);assert.equal(result.periods['1h'].EUR,null);
});
test('optional DXY is validated independently and never becomes live when absent or stale',()=>{
  const data=fixture();
  data.dxy={symbol:'DXY',bid:98.25,ask:98.27,tickAt:now-1000,baselines:Object.fromEntries(Object.entries(targets(now)).map(([p,at])=>[p,{at,price:98}]))};
  const live=presentMT5(validateMT5(data,now),now);
  assert.equal(live.dxy.status,'fresh'); assert.equal(live.dxy.price,98.25);
  assert.ok(live.dxy.changes['1h']>0);
  assert.equal(presentMT5(validateMT5(fixture(),now),now).dxy.status,'unavailable');
  data.dxy.tickAt=now-11000;
  assert.equal(presentMT5(validateMT5(data,now),now).dxy.status,'stale');
  data.dxy.ask=90; assert.throws(()=>validateMT5(data,now));
});
test('USD basket estimate requires all six fresh MT5 mids and is never described as official DXY',()=>{
  const data=fixture();
  const bids={'EUR/USD':1.15,'USD/JPY':150,'GBP/USD':1.33,'USD/CAD':1.4,'USD/CHF':0.82};
  for(const quote of data.quotes) if(bids[quote.symbol]) { quote.bid=bids[quote.symbol]; quote.ask=quote.bid+0.0002; }
  data.usdSek={symbol:'USD/SEK',bid:9.1,ask:9.1004,tickAt:now-1000,
    baselines:Object.fromEntries(Object.entries(targets(now)).map(([p,at])=>[p,{at,price:9.0}]))};
  const result=presentMT5(validateMT5(data,now),now);
  const mids={EURUSD:1.1501,USDJPY:150.0001,GBPUSD:1.3301,USDCAD:1.4001,USDSEK:9.1002,USDCHF:0.8201};
  const expected=50.14348112 * mids.EURUSD**-0.576 * mids.USDJPY**0.136 * mids.GBPUSD**-0.119 * mids.USDCAD**0.091 * mids.USDSEK**0.042 * mids.USDCHF**0.036;
  assert.ok(Math.abs(result.usdBasketEstimate.price-expected)<1e-9);
  assert.equal(result.usdBasketEstimate.status,'fresh');assert.equal(result.usdBasketEstimate.official,false);
  assert.equal(result.dxy.status,'unavailable');
  const old=structuredClone(data);old.usdSek.tickAt=now-11000;
  assert.equal(presentMT5(validateMT5(old,now),now).usdBasketEstimate.status,'unavailable');
  const absent=structuredClone(data);delete absent.usdSek;
  assert.equal(presentMT5(validateMT5(absent,now),now).usdBasketEstimate.status,'unavailable');
  const malformed=structuredClone(data);malformed.usdSek.symbol='USD/XXX';
  assert.throws(()=>validateMT5(malformed,now));
  const unrelated=structuredClone(data);unrelated.usdSek.accountPassword='not-stored';
  assert.equal(validateMT5(unrelated,now).usdSek.accountPassword,undefined);
});
test('MT5 API enforces authentication, payload bounds and Supabase-only storage',async()=>{
  const originalFetch=globalThis.fetch, oldSource=process.env.MARKET_CONTEXT_SOURCE;
  Object.assign(process.env,{MT5_INGEST_TOKEN:secret,DASHBOARD_READ_TOKEN:read,NINJATRADER_INGEST_TOKEN:'n'.repeat(40),NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',MARKET_CONTEXT_SOURCE:'mt5'});
  let stored=null;
  globalThis.fetch=async(url,options)=>{
    const target=String(url);
    assert.ok(target.startsWith('https://project.supabase.co/rest/v1/'));
    assert.equal(options.headers.apikey,'sb_secret_test_only');
    assert.equal(options.headers.authorization,undefined);
    if(target.includes('market_feed_latest?select=payload')) return Response.json(stored?[{payload:stored}]:[]);
    if(target.includes('market_feed_latest?on_conflict=instrument')) stored=JSON.parse(options.body).payload;
    return new Response(null,{status:204});
  };
  try {
    assert.equal((await POST(request(read,fixture()))).status,401);
    process.env.MT5_INGEST_TOKEN=read;assert.equal((await POST(request(read,fixture()))).status,401);process.env.MT5_INGEST_TOKEN=secret;
    assert.equal((await POST(request(secret,'x'.repeat(33000)))).status,413);
    assert.equal((await POST(request(secret,'{bad'))).status,400);
    assert.equal((await POST(request(secret,fixture(),{'Content-Type':'text/plain'}))).status,415);
    const get=()=>GET(new Request('https://test.invalid/api/market-context',{headers:{Authorization:`Bearer ${read}`}}));
    assert.equal((await (await get()).json()).reason,'waiting_mt5');
    const live=fixture(Date.now());assert.equal((await POST(request(secret,live))).status,200);
    const response=await get();assert.equal(response.headers.get('cache-control'),'no-store, private');
    assert.equal((await response.json()).source,'MT5 / FOREX.com');
    globalThis.fetch=async()=>{throw Error('private-details')};
    assert.equal((await POST(request(secret,live))).status,503);
    assert.equal((await (await get()).json()).reason,'storage_unavailable');
  } finally {globalThis.fetch=originalFetch;if(oldSource===undefined)delete process.env.MARKET_CONTEXT_SOURCE;else process.env.MARKET_CONTEXT_SOURCE=oldSource;}
});
test('bridge contains no trading, credential/account export, DLL or file-writing operations',async()=>{
  const source=await readFile(new URL('../mt5/MarketCommandFX.mq5',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(OrderSend|OrderSendAsync|CTrade|PositionClose|FileOpen|ACCOUNT_LOGIN|ACCOUNT_BALANCE|ACCOUNT_NAME)\b|#import/);
  assert.match(source,/EventSetTimer\(1\)/);assert.match(source,/SymbolInfoTick/);assert.match(source,/WebRequest/);
});
