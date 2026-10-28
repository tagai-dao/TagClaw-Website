import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../worker/index';
import {readWorldJson} from '../world/transport';
const environment={WORLD_RUNTIME_ORIGIN:'https://bsc-api.tagai.fun',ASSETS:{fetch:async()=>new Response('asset')}} as unknown as TagClawWorkerEnv;
test('production routes world JSON to the public API before SPA fallback without browser credentials',async()=>{
 let url='',init:RequestInit|undefined;
 const worker=createWorker(async(input,options)=>{url=String(input);init=options;return Response.json({version:1})});
 const response=await worker.fetch(new Request('https://tagclaw.com/world-data/bootstrap',{headers:{Cookie:'private',Authorization:'secret'}}),environment);
 assert.equal(url,'https://bsc-api.tagai.fun/world-data/bootstrap');assert.equal(new Headers(init?.headers).get('Cookie'),null);assert.equal(new Headers(init?.headers).get('Authorization'),null);assert.deepEqual(await response.json(),{version:1});assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(await (await worker.fetch(new Request('https://tagclaw.com/communities'),environment)).text(),'asset');
});
test('missing runtime and accidental HTML return a clear JSON service error, never index.html',async()=>{
 const worker=createWorker(async()=>new Response('<html>SPA</html>',{headers:{'Content-Type':'text/html'}}));const response=await worker.fetch(new Request('https://tagclaw.com/world-data/bootstrap'),environment);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'WORLD_RUNTIME_NOT_DEPLOYED');
 await assert.rejects(()=>readWorldJson(new Response('<html/>',{headers:{'Content-Type':'text/html'}})),/返回了网页/);
 await assert.rejects(()=>readWorldJson(Response.json({error:'runtime missing'},{status:503})),/runtime missing/);
});
test('SSE is streamed, resumes cursor and does not retain the connection timeout signal after headers',async()=>{
 let signal:AbortSignal|undefined,cursor:string|null=null;const worker=createWorker(async(_,options)=>{signal=options?.signal??undefined;cursor=new Headers(options?.headers).get('Last-Event-ID');return new Response('event: status\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}})});
 const response=await worker.fetch(new Request('https://tagclaw.com/world-data/stream?after=5',{headers:{'Last-Event-ID':'7'}}),environment);assert.equal(cursor,'7');assert.equal(signal?.aborted,false);assert.equal(response.headers.get('x-accel-buffering'),'no');assert.match(await response.text(),/event: status/);
});
test('only fixed public read routes are proxied',async()=>{
 let calls=0;const worker=createWorker(async()=>{calls++;return Response.json({})});
 assert.equal((await worker.fetch(new Request('https://tagclaw.com/world-data/admin'),environment)).status,404);
 assert.equal((await worker.fetch(new Request('https://tagclaw.com/world-data/bootstrap',{method:'POST'}),environment)).status,405);assert.equal(calls,0);
});
