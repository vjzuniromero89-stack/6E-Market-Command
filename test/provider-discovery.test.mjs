import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverTwelveData, DISCOVERY_TERMS } from '../lib/provider-discovery.mjs';
import { GET } from '../app/api/provider-discovery/route.js';

test('provider discovery uses fixed searches, sanitizes output and never returns API key',async()=>{
  const key='private-provider-key'; const seen=[];
  const result=await discoverTwelveData(key,async (url,options)=>{
    seen.push(url); assert.equal(url.searchParams.get('apikey'),key);
    assert.equal(options.redirect,'manual');
    return Response.json({status:'ok',data:[{symbol:url.searchParams.get('symbol')+'N',instrument_name:'Unrelated company',exchange:'TEST'},{symbol:url.searchParams.get('symbol'),instrument_name:'Verified instrument',exchange:'TEST',instrument_type:'Index',access:{plan:'Basic'},secret:key}]});
  });
  assert.deepEqual(seen.slice(0,4).map(url=>url.searchParams.get('symbol')),DISCOVERY_TERMS);
  assert.deepEqual(seen.slice(4).map(url=>url.pathname),['/symbol_search','/bonds','/quote']);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(key));
  assert.equal(result.results.DXY[0].name,'Verified instrument');
  assert.equal(result.results.DXY.length,1);
});

test('provider redirects and errors fail without revealing the API key',async()=>{
  const key='private-provider-key';
  await assert.rejects(discoverTwelveData(key,async()=>new Response(null,{status:302,headers:{Location:'https://example.invalid'}})),/redirigió/);
  await assert.rejects(discoverTwelveData(key,async()=>Response.json({status:'error',message:key})),error=>!String(error).includes(key));
});

test('bond catalog candidates and dated US2Y quote remain diagnostic only',async()=>{
  const key='private-provider-key'; const updated=new Date(Date.now()-60000).toISOString();
  const result=await discoverTwelveData(key,async url=>{
    if(url.pathname==='/symbol_search' && url.searchParams.get('symbol')==='US Dollar Index') return Response.json({status:'ok',data:[
      {symbol:'DXY-REAL',instrument_name:'US Dollar Index',instrument_type:'Index',access:{plan:'Pro'}},
      {symbol:'DXY-ETF',instrument_name:'US Dollar Index ETF',instrument_type:'ETF'},
    ]});
    if(url.pathname==='/bonds') {
      assert.equal(url.searchParams.get('country'),'Germany');
      return Response.json({status:'ok',result:{count:3,list:[
        {symbol:'DE2Y-CANDIDATE',name:'Germany Government Bond Yield 2 Years',country:'Germany',access:{plan:'Grow'}},
        {symbol:'DE10Y',name:'Germany Government Bond Yield 10 Years'},
        {symbol:'CORP2Y',name:'Company Bond 2 Years'},
      ]}});
    }
    if(url.pathname==='/quote') {
      assert.equal(url.searchParams.get('symbol'),'US2Y');
      return Response.json({symbol:'US2Y',close:'3.456',last_update_at:updated,timestamp:Math.floor(Date.now()/1000)});
    }
    return Response.json({status:'ok',data:[{symbol:url.searchParams.get('symbol'),instrument_name:'Exact match'}]});
  });
  assert.equal(result.us2yQuote.status,'quote_received');
  assert.equal(result.us2yQuote.value,3.456);
  assert.equal(result.us2yQuote.lastUpdatedAt,updated);
  assert.deepEqual(result.germanBonds.candidates.map(item=>item.symbol),['DE2Y-CANDIDATE']);
  assert.deepEqual(result.dollarIndex.candidates.map(item=>item.symbol),['DXY-REAL']);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(key));
  assert.equal(result.spread,undefined);
});

test('a quote without a verifiable timestamp cannot be treated as current',async()=>{
  const result=await discoverTwelveData('private-provider-key',async url=>{
    if(url.pathname==='/bonds') return Response.json({status:'ok',result:{count:0,list:[]}});
    if(url.pathname==='/quote') return Response.json({symbol:'US2Y',close:'3.456'});
    return Response.json({status:'ok',data:[{symbol:url.searchParams.get('symbol'),instrument_name:'Exact match'}]});
  });
  assert.equal(result.us2yQuote.status,'timestamp_unverified');
  assert.equal(result.us2yQuote.lastUpdatedAt,null);
});

test('provider discovery route requires dashboard authentication',async()=>{
  const previous=process.env.DASHBOARD_READ_TOKEN;
  process.env.DASHBOARD_READ_TOKEN='r'.repeat(40);
  try{assert.equal((await GET(new Request('https://test.invalid/api/provider-discovery'))).status,401);}
  finally{if(previous===undefined)delete process.env.DASHBOARD_READ_TOKEN;else process.env.DASHBOARD_READ_TOKEN=previous;}
});
