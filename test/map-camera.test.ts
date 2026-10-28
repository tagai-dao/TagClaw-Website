import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zoomMap} from '../world/map-camera';
test('wheel zoom keeps the map coordinate under the pointer fixed',()=>{
 const before={zoom:2,x:40,y:-20},pointer={x:150,y:80},after=zoomMap(before,-90,pointer.x,pointer.y);
 assert.ok(after.zoom>before.zoom);assert.ok(Math.abs((pointer.x-before.x)/before.zoom-(pointer.x-after.x)/after.zoom)<1e-8);assert.ok(Math.abs((pointer.y-before.y)/before.zoom-(pointer.y-after.y)/after.zoom)<1e-8);
});
test('zoom stays bounded and returns to a centered complete overview',()=>{
 let camera={zoom:1,x:0,y:0};for(let n=0;n<100;n++)camera=zoomMap(camera,-120,40,50);assert.equal(camera.zoom,4);
 for(let n=0;n<100;n++)camera=zoomMap(camera,120,40,50);assert.deepEqual(camera,{zoom:1,x:0,y:0});
});
