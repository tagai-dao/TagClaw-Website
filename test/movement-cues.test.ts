import test from 'node:test';
import assert from 'node:assert/strict';
import {route,walkable} from '../world/island-path';
import {estateWalkable} from '../world/estate-path';
test('town routes end at the destination and never cross obstacles',()=>{
 const start={x:75,y:62},end={x:54,y:62},steps=route(start,end);assert.ok(steps.length);assert.deepEqual(steps.at(-1),end);assert.ok(steps.every(walkable));
 let previous=start;for(const next of steps){assert.equal(Math.abs(next.x-previous.x)+Math.abs(next.y-previous.y),1);previous=next;}
 assert.deepEqual(route(start,{x:0,y:100}),[]);assert.deepEqual(route(start,start),[]);
});
test('estate navigation uses estate paths and reaches the requested point',()=>{
 const steps=route({x:40,y:45},{x:39,y:75},estateWalkable);assert.deepEqual(steps.at(-1),{x:39,y:75});assert.ok(steps.every(estateWalkable));assert.deepEqual(route({x:40,y:45},{x:60,y:75},estateWalkable),[]);
});
