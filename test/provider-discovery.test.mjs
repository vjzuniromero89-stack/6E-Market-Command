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
  assert.deepEqual(seen.map(url=>url.searchParams.get('symbol')),DISCOVERY_TERMS);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(key));
  assert.equal(result.results.DXY[0].name,'Verified instrument');
  assert.equal(result.results.DXY.length,1);
});

test('provider redirects and errors fail without revealing the API key',async()=>{
  const key='private-provider-key';
  await assert.rejects(discoverTwelveData(key,async()=>new Response(null,{status:302,headers:{Location:'https://example.invalid'}})),/redirigió/);
  await assert.rejects(discoverTwelveData(key,async()=>Response.json({status:'error',message:key})),error=>!String(error).includes(key));
});

test('provider discovery route requires dashboard authentication',async()=>{
  const previous=process.env.DASHBOARD_READ_TOKEN;
  process.env.DASHBOARD_READ_TOKEN='r'.repeat(40);
  try{assert.equal((await GET(new Request('https://test.invalid/api/provider-discovery'))).status,401);}
  finally{if(previous===undefined)delete process.env.DASHBOARD_READ_TOKEN;else process.env.DASHBOARD_READ_TOKEN=previous;}
});
