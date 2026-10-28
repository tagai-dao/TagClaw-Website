import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {walkPosition} from '../world/scheduler';
test('world stylesheet is CSS and contains the landscape and resident presentation',()=>{
 const css=readFileSync(new URL('../world/world.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/import React|export default|return </);assert.match(css,/\.town-landscape\{/);assert.match(css,/\.resident-sprite\{/);assert.match(css,/prefers-reduced-motion/);
});
test('observed venue travel follows the street and settles at its destination',()=>{
 const from={x:100,y:550},to={x:570,y:330};assert.deepEqual(walkPosition(from,to,0),from);assert.deepEqual(walkPosition(from,to,2400),to);assert.equal(walkPosition(from,to,1200).y,350);
});
