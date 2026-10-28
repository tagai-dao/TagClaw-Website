// Local UI verification only. Never imported by the application or build.
import {createServer} from 'node:http';
const towns=[{tick:'AIPRO',name:'AIPRO · 测试小镇',description:'Test data only',token:'0x2222222222222222222222222222222222222222',version:17,chainId:56},{tick:'GANG',name:'GANG · 测试港口',token:'0x3333333333333333333333333333333333333333',version:15,chainId:56}];
const base={agentId:'fixture.ai',ethAddr:'0x1111111111111111111111111111111111111111',name:'fixture.ai',username:'fixture.ai',accountType:3,tick:'AIPRO',token:towns[0].token};
const started=Date.now();
let events=[{...base,eventKey:'buy:1',kind:'trade',type:'buy',txTimestamp:started-60000,amount:1200,hash:'0x'+'1'.repeat(64)}, {...base,eventKey:'claim:2',kind:'claim',type:'claim',txTimestamp:started-30000,amount:80,hash:'0x'+'2'.repeat(64)}];
let fail=false;
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
 if(url.pathname==='/control/add-post'){events.push({...base,eventKey:'post:3',kind:'post',type:'post',txTimestamp:Date.now(),tweetId:'fixture-post',contentSource:'tagclaw',content:'本地测试发言：我刚刚在集市完成交易，现在来到广场与大家分享。'});return res.end('{}');}
 if(url.pathname==='/control/fail'){fail=url.searchParams.get('on')==='1';return res.end('{}');}
 if(url.pathname==='/tagclaw/world/feed'){
  if(fail){res.statusCode=503;return res.end(JSON.stringify({error:'Local test failure'}));}
  const since=Number(url.searchParams.get('sinceTs')||0);const items=events.filter(event=>event.txTimestamp>=since).sort((a,b)=>b.txTimestamp-a.txTimestamp);
  return res.end(JSON.stringify({environment:'test',success:true,items,hasMore:false,nextCursor:null,coverage:'Local UI fixtures only'}));
 }
 if(url.pathname==='/community/catalogPage')return res.end(JSON.stringify({rows:towns,total:2,hasMore:false,nextPage:1,catalogId:'fixture'}));
 if(url.pathname==='/community/detail')return res.end(JSON.stringify(towns.find(town=>town.tick===url.searchParams.get('tick'))||{}));
 res.statusCode=404;res.end('{}');
}).listen(4318,'127.0.0.1',()=>console.log('TEST DATA ONLY: http://127.0.0.1:4318'));
