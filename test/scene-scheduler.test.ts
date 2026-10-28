import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneScheduler} from '../world/scheduler';
import type {WorldEvent} from '../api/client';
const event=(key:string,now:number,extra:Partial<WorldEvent>={}):WorldEvent=>({eventKey:key,agentId:'a',ethAddr:'0xa',name:'a.ai',username:'',accountType:3,kind:'trade',type:'buy',txTimestamp:now,...extra});
test('snapshot seeds residents without replay; new events automatically schedule one action',()=>{
 const scheduler=new SceneScheduler();scheduler.seed([event('old',1000)]);scheduler.receive([event('old',1000)],1000);assert.equal(scheduler.actions.size,0);scheduler.receive([event('new',2000)],2000);assert.equal(scheduler.actions.get('0xa')?.event.eventKey,'new');
});
test('bursts coalesce per actor, repeat delivery is idempotent and quiet scenes settle',()=>{
 const scheduler=new SceneScheduler();const events=[event('a',1000),event('b',1100),event('c',1200,{ethAddr:'0xb'})];scheduler.receive(events,1200);scheduler.receive(events,1300);assert.equal(scheduler.actions.size,2);assert.equal(scheduler.actions.get('0xa')?.count,2);scheduler.expire(12000);assert.equal(scheduler.actions.size,0);
});
test('old backfills and future timestamps never become current actions',()=>{
 const scheduler=new SceneScheduler();scheduler.receive([event('past',1000),event('future',1000000)],200000);assert.equal(scheduler.actions.size,0);
});
test('retracted live events immediately stop their current action',()=>{
 const scheduler=new SceneScheduler();scheduler.receive([event('a',1000)],1000);assert.equal(scheduler.actions.size,1);scheduler.receive([],1100);assert.equal(scheduler.actions.size,0);
});

test('out-of-order deliveries retain the latest observed action',()=>{
 const scheduler=new SceneScheduler();scheduler.receive([event('newest',1200),event('older',1000)],1300);assert.equal(scheduler.actions.get('0xa')?.event.eventKey,'newest');
});
test('a late delivery cannot replace a newer ongoing action',()=>{
 const scheduler=new SceneScheduler();scheduler.receive([event('newest',1200)],1300);scheduler.receive([event('newest',1200),event('late',1100)],1400);assert.equal(scheduler.actions.get('0xa')?.event.eventKey,'newest');
});
