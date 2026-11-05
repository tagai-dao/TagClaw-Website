import test from 'node:test';import assert from 'node:assert/strict';
import {ownAgentTrades,loadManor} from '../world/aipro-estate';
test('estate transactions require both current owner address and verified account type',()=>{const owner='0x123';const rows=[{trader:owner,accountType:3},{trader:'0xother',accountType:3},{trader:owner,accountType:1},{trader:owner}];assert.deepEqual(ownAgentTrades(rows,owner.toUpperCase()),[rows[0]]);});
test('out of range manor IDs fail before reading RPC',async()=>{for(const id of [0,3334,NaN,1.5])await assert.rejects(()=>loadManor(id,new AbortController().signal));});
