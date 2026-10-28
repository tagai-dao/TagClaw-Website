import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEvents, eventTown, residentsFrom, compareEvents, eventPlace, plainContent, layoutResidents } from '../world/model';
import { publicTradeEvent, publicPostEvent, publicWindow } from '../world/source';
import type { ApiCommunity, WorldEvent, ApiTweet } from '../api/client';
const make=(key:string,ts=1000,extra:Partial<WorldEvent>={}):WorldEvent=>({eventKey:key,txTimestamp:ts,agentId:'a.ai',ethAddr:'0xabc',name:'a.ai',username:'a.ai',accountType:3,type:'buy',kind:'trade',...extra});

test('rejects non-.ai accounts and invalid events; keeps events in the same hash distinct',()=>{
 const rows=mergeEvents([], [make('a',1,{hash:'same'}),make('b',1,{hash:'same'}),make('c',2,{accountType:2}),make('d',NaN),make('e',0)]);
 assert.deepEqual(rows.map(row=>row.eventKey),['b','a']);
});
test('overlapping and late pages merge idempotently and updated payloads replace old ones',()=>{
 const previous=mergeEvents([],[make('a',100),make('b',300)]);
 const rows=mergeEvents(previous,[make('a',100,{amount:2}),make('late',200),make('b',300)]);
 assert.equal(rows.length,3);assert.deepEqual(rows.map(row=>row.txTimestamp),[300,200,100]);assert.equal(rows[2].amount,2);
});
test('contracts override colliding community symbols',()=>{
 const towns=[{tick:'FIRST',token:'0x111'},{tick:'SECOND',token:'0x222'}] as ApiCommunity[];
 assert.equal(eventTown(make('a',1,{tick:'FIRST',token:'0x222'}),towns),'SECOND');
 assert.equal(eventTown(make('b',1,{tick:'FIRST',token:'0x333'}),towns),null);
 assert.equal(eventTown(make('c',1,{tick:'FIRST'}),towns),'FIRST');
});
test('resident grouping uses the wallet and preserves the newest observed identity',()=>{
 const rows=[make('a',100,{name:'old.ai'}),make('b',200,{name:'new.ai',ethAddr:'0xAbC'}),make('c',50,{ethAddr:'0xother'})];
 const actors=residentsFrom(rows);assert.equal(actors.length,2);assert.equal(actors[0].name,'new.ai');assert.equal(actors[0].events.length,2);
});
test('replay snapshot is independent from later live ingestion',()=>{
 const live=mergeEvents([],[make('a',100),make('b',200)]);
 const frozen=[...live].sort(compareEvents).reverse();
 const updated=mergeEvents(live,[make('c',300)]);
 assert.deepEqual(frozen.map(row=>row.eventKey),['a','b']);assert.equal(updated[0].eventKey,'c');
});
test('event routing uses actual semantics, with no generated financial actions',()=>{
 assert.equal(eventPlace(make('p',1,{type:'post',kind:'post'})),'square');
 assert.equal(eventPlace(make('t',1,{type:'transfer',kind:'transfer'})),'square');
 assert.equal(eventPlace(make('c',1,{type:'claim',kind:'claim'})),'rewards');
 assert.equal(eventPlace(make('s',1,{type:'sell'})),'market');
 assert.equal(plainContent('<b>hello</b>  world'),'hello world');
});
test('public trade adapter excludes unknown identity and ambiguous event logs',()=>{
 const trade={accountType:3,twitterId:'a.ai',timestamp:100,transHash:'0xhash',logIndex:0,isBuy:1,trader:'0xa',amount:2};
 const row=publicTradeEvent(trade);assert.equal(row?.eventKey,'bsc:0xhash:0');assert.equal(row?.txTimestamp,100000);
 assert.equal(publicTradeEvent({...trade,accountType:2}),null);
 assert.equal(publicTradeEvent({...trade,logIndex:undefined}),null);
 assert.equal(publicTradeEvent({...trade,logIndex:1})?.eventKey,'bsc:0xhash:1');
});
test('post adapter keeps the original words and labels uncertain source as indexed',()=>{
 const row=publicPostEvent({tweetId:'tweet',twitterId:'a.ai',accountType:3,content:'I wrote this',tweetTime:'2026-10-26T01:00:00Z'} as ApiTweet);
 assert.equal(row?.content,'I wrote this');assert.equal(row?.contentSource,'indexed');
 assert.equal(publicPostEvent({tweetId:'tweet',twitterId:'human',accountType:0,tweetTime:'invalid'} as ApiTweet),null);
});
test('limited public window exposes partial content failure and never fabricates posts',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input)=>new Response(JSON.stringify(String(input).includes('tradeFeed')?[{accountType:3,twitterId:'a.ai',timestamp:100,transHash:'0xhash',logIndex:1,isBuy:1}]:{}),{status:String(input).includes('tradeFeed')?200:503,headers:{'Content-Type':'application/json'}});
 try{const result=await publicWindow();assert.equal(result.mode,'public');assert.equal(result.hasMore,false);assert.match(result.notice,/内容接口暂不可用/);assert.equal(result.items.every(row=>row.kind==='trade'),true);}
 finally{globalThis.fetch=original;}
});

test('crowded scenes assign separate action locations deterministically',()=>{
 const actors=residentsFrom(Array.from({length:12},(_,index)=>make(`event${index}`,100+index,{agentId:`${index}.ai`,ethAddr:`0x${index}`})),12);
 const points=layoutResidents(actors);
 assert.equal(new Set([...points.values()].map(point=>`${point.x}:${point.y}`)).size,12);
 assert.deepEqual([...layoutResidents([...actors].reverse())], [...points]);
});

test('ATLAS maps contracts, verifies snapshot membership and uses real block time',async()=>{
 const {atlasTownEvents}=await import('../world/atlas');
 const bundle={manifest:{chainId:56,snapshotBlock:100,identitySnapshotBlock:100,snapshotTime:'2026-10-27T00:00:00Z',tokens:[{address:'0x111',agentWallets:1}]},agents:[{owner:'0xabc',name:'alice.ai',chainVerified:true,block:100}],feed:[{kind:'token',owner:'0xAbC',name:'alice.ai',assetId:'0x111',direction:'buy',amount:'12',tx:`0x${'a'.repeat(64)}`,block:90,logIndex:2}]};
 const times:number[]=[];
 const events=await atlasTownEvents(bundle,{tick:'GANG',token:'0x111'},new AbortController().signal,async block=>{times.push(block);return 123456;});
 assert.deepEqual(times,[90]);assert.equal(events[0].txTimestamp,123456);assert.equal(events[0].accountType,null);assert.equal(events[0].identitySource,'atlas-registry');assert.equal(events[0].tick,'GANG');
 assert.equal(mergeEvents([],events).length,1);
 assert.equal((await atlasTownEvents(bundle,{tick:'GANG',token:'0x222'},new AbortController().signal)).length,0);
 const wrongName={...bundle,feed:bundle.feed.map(row=>({...row,name:'forged.ai'}))};
 assert.equal((await atlasTownEvents(wrongName,{tick:'GANG',token:'0x111'},new AbortController().signal)).length,0);
 const wrongSnapshot={...bundle,agents:bundle.agents.map(row=>({...row,block:99}))};
 assert.equal((await atlasTownEvents(wrongSnapshot,{tick:'GANG',token:'0x111'},new AbortController().signal)).length,0);
});

test('community queries are scoped by contract and keep account_type=3 filtering',async()=>{
 const {publicTownWindow}=await import('../world/source');
 const original=globalThis.fetch;const paths:string[]=[];
 globalThis.fetch=async input=>{paths.push(String(input));return new Response(JSON.stringify(String(input).includes('tradeList')?[{accountType:3,twitterId:'id',trader:'0xabc',timestamp:100,transHash:'0xABC',logIndex:0,token:'0x111'},{accountType:2,twitterId:'human',timestamp:100,transHash:'0xDEF',logIndex:1}]:[]));};
 try{const rows=await publicTownWindow({tick:'GANG',token:'0x111'});assert.equal(rows.length,1);assert.equal(rows[0].tick,'GANG');assert.ok(paths.some(path=>path.includes('token=0x111')));}finally{globalThis.fetch=original;}
});

test('town facilities distinguish platform eligibility, dividend configuration and automatic burn',async()=>{
 const {townFacilities}=await import('../world/capabilities');
 const town={tick:'TEST',token:'0x111',chainId:56,launchProtocol:'flap-id-agent-curve'} as ApiCommunity;
 assert.equal(townFacilities(town).vault?.status,'pending');assert.equal(townFacilities(town).burn,undefined);
 assert.equal(townFacilities({...town,worldCapabilities:{taxStatus:'untaxed'}}).vault,undefined);
 assert.equal(townFacilities({...town,worldCapabilities:{holderDividends:{enabled:false}}}).vault,undefined);
 assert.equal(townFacilities({...town,worldCapabilities:{holderDividends:{enabled:true},autoBurn:{enabled:true,mechanism:'tax-burn'}}}).burn?.status,'confirmed');
 assert.equal(townFacilities({...town,worldCapabilities:{autoBurn:{enabled:true,mechanism:'manual'}}}).burn,undefined);
 assert.equal(townFacilities({...town,launchProtocol:'four-agent-id'}).vault?.status,'pending');
 assert.equal(townFacilities({...town,launchProtocol:undefined,version:15,isImport:0}).vault?.status,'pending');
 assert.deepEqual(townFacilities({...town,launchProtocol:undefined,tick:'GANG'}),{});
 const gang={...town,token:'0x0c6302401aa5325c2e36f170f52c00b1d220b405'};
 assert.equal(townFacilities(gang).burn?.sourceUrl,'https://gang.fun/burn');
 assert.deepEqual(townFacilities({...gang,chainId:1}),{});
 assert.equal(townFacilities({...gang,worldCapabilities:{autoBurn:{enabled:false,mechanism:'buyback-burn'}}}).burn,undefined);
 assert.deepEqual(townFacilities(null),{});
});
