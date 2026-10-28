import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectEvents} from '../world/projection';
import type {WorldEvent} from '../api/client';
const row=(n:number,town='A',actor='a'):WorldEvent=>({eventKey:String(n),agentId:actor,ethAddr:actor,name:actor,username:'',accountType:3,kind:'trade',type:'buy',token:town,txTimestamp:n});
test('snapshot projection keeps latest actor state and town memory instead of growing with history',()=>{
 let events:WorldEvent[]=[];for(let n=1;n<=1000;n++)events=projectEvents(events,{type:'upsert',event:row(n)});
 assert.equal(events.length,8);assert.equal(events[0].eventKey,'1000');events=projectEvents(events,{type:'upsert',event:row(1,'B','quiet')});assert.equal(events.some(e=>e.token==='B'),true);
});
test('projection corrections and retractions replace only their canonical event',()=>{
 let events=projectEvents([row(1),row(2)],{type:'upsert',event:{...row(2),amount:42}});assert.equal(events[0].amount,42);events=projectEvents(events,{type:'remove',eventKey:'2'});assert.deepEqual(events.map(e=>e.eventKey),['1']);
});
test('live projection keeps chain memories when recent speech fills the same resident town',()=>{
 let events=[row(1)];for(let n=2;n<20;n++)events=projectEvents(events,{type:'upsert',event:{...row(n),kind:'post',type:'post',communityToken:'A',token:undefined}});
 assert.equal(events.some(event=>event.eventKey==='1'),true);assert.equal(events.filter(event=>event.kind==='post').length,8);
});
