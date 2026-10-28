const worldRoute=/^\/world-data\/(?:bootstrap|history|stream|health|profile\/0x[0-9a-f]{40})$/i;
const json=(status:number,code:string,error:string)=>new Response(JSON.stringify({code,error}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function createWorker(fetchUpstream:typeof fetch=fetch){return {
 async fetch(request:Request,env:TagClawWorkerEnv):Promise<Response>{
  const incoming=new URL(request.url);
  if(!incoming.pathname.startsWith('/world-data'))return env.ASSETS.fetch(request);
  if(!worldRoute.test(incoming.pathname))return json(404,'WORLD_ROUTE_NOT_FOUND','Unknown world data route');
  if(!['GET','HEAD'].includes(request.method))return json(405,'WORLD_READ_ONLY','World data is read-only');
  let origin:URL;
  try{origin=new URL(env.WORLD_RUNTIME_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash)throw new Error();}catch{return json(503,'WORLD_ORIGIN_INVALID','世界数据服务地址未正确配置');}
  const upstream=new URL(incoming.pathname+incoming.search,origin),headers=new Headers({Accept:incoming.pathname.endsWith('/stream')?'text/event-stream':'application/json'});
  const cursor=request.headers.get('Last-Event-ID');if(cursor&&/^\d+$/.test(cursor))headers.set('Last-Event-ID',cursor);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetchUpstream(upstream,{method:request.method,headers,redirect:'manual',signal:AbortSignal.any([request.signal,controller.signal])});
   const type=response.headers.get('Content-Type')||'',stream=incoming.pathname.endsWith('/stream');
   if(response.status===404||response.status>=300&&response.status<400||!type.includes(stream&&response.ok?'text/event-stream':'application/json')){await response.body?.cancel();return json(503,'WORLD_RUNTIME_NOT_DEPLOYED','世界数据服务尚未接入生产 API，请启动 BSC world-runtime');}
   const forwarded=new Headers({'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   if(stream){forwarded.set('Cache-Control','no-cache, no-transform');forwarded.set('X-Accel-Buffering','no');}
   // Pass the readable stream through; do not buffer SSE or proxy browser credentials.
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:forwarded});
  }catch{return json(503,'WORLD_UPSTREAM_UNAVAILABLE','世界数据服务暂时无法连接，正在恢复');}
  finally{clearTimeout(timer);}
 }
};}
export default createWorker();
