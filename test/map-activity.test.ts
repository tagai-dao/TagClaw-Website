import test from 'node:test';
import assert from 'node:assert/strict';
import {mapActivity,activityTime} from '../world/map-activity';
import type {ApiCommunity,WorldEvent} from '../api/client';
const towns=[{tick:'ALPHA',token:'0x111'},{tick:'BETA',token:'0x222'}] as ApiCommunity[];
const event=(key:string,ts:number,extra:Partial<WorldEvent>={}):WorldEvent=>({eventKey:key,agentId:'alice',accountType:3,ethAddr:'0xabc',name:'alice.ai',username:'',kind:'trade',type:'buy',txTimestamp:ts,token:'0x111',...extra});
test('map selects latest records by timestamp, maps exact contracts, and preserves posts for the detail timeline',()=>{
 const rows=mapActivity(towns,[event('old',100),event('post',300,{kind:'post',type:'post',content:'original words'}),event('beta',200,{tick:'ALPHA',token:'0x222'}),event('late-arrival',150),event('future',1000),event('human',500,{accountType:2})],600);
 assert.deepEqual(rows.get('ALPHA')!.map(row=>row.eventKey),['post','late-arrival','old']);
 assert.equal(rows.get('ALPHA')![0].content,'original words');assert.equal(rows.get('BETA')![0].eventKey,'beta');
 assert.equal(mapActivity(towns,[event('unknown',100,{token:'0x333'})],600).size,0);
});
test('cross-source copies of the same log do not repeat, but different logs of one tx remain',()=>{
 const rows=mapActivity(towns,[event('indexed',100,{hash:'0xABC',logIndex:1}),event('atlas',100,{hash:'0xabc',logIndex:1,accountType:null,identitySource:'atlas-registry',identitySnapshotBlock:2,blockNumber:1,sourceUrl:'https://agent-id.tagai.fun'}),event('other-log',100,{hash:'0xabc',logIndex:2})],600).get('ALPHA')!;
 assert.equal(rows.length,2);assert.ok(rows.some(row=>row.eventKey==='indexed'));assert.ok(rows.some(row=>row.eventKey==='other-log'));
});
test('newer arrivals replace the visible latest record while out-of-order older events do not',()=>{
 const previous=[event('current',300),event('post',200,{kind:'post',type:'post'})];
 assert.equal(mapActivity(towns,[...previous,event('late',100)],600).get('ALPHA')![0].eventKey,'current');
 assert.equal(mapActivity(towns,[...previous,event('new',400)],600).get('ALPHA')![0].eventKey,'new');
 assert.equal(mapActivity(towns,Array.from({length:20},(_,i)=>event(String(i),i+1)),600).get('ALPHA')!.length,8);
 assert.equal(activityTime(100000,100001),'刚刚');assert.equal(activityTime(100000,220000),'2 分钟前');
});
test('recent speech cannot evict the island latest chain activity on first load',()=>{
 const events=[event('latest-chain',100),...Array.from({length:15},(_,i)=>event(`speech-${i}`,200+i,{kind:'post',type:'post'}))];
 const rows=mapActivity(towns,events,600).get('ALPHA')!;assert.equal(rows.find(row=>row.kind!=='post')?.eventKey,'latest-chain');assert.equal(rows.filter(row=>row.kind==='post').length,8);
});
