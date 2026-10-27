import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolUrl,normalizeGang,normalizeTagAI,withProtocol,rawUnits} from '../world/protocol';
import {readFlapTax,FLAP_HELPER,MULTICALL} from '../world/flap';
import {townFacilities} from '../world/capabilities';
import type {ApiCommunity} from '../api/client';
const token='0xb0e974ee58899dd77eb13c2c0a0adefeb30f7777';
const town={token,tick:'BIBI',chainId:56,launchProtocol:'flap-id-agent-curve'} as ApiCommunity;
test('official CA links are platform specific and reject malformed contracts',()=>{
 assert.equal(protocolUrl(town),`https://flap.sh/bnb/${token}/taxinfo?lang=zh`);
 assert.equal(protocolUrl({...town,launchProtocol:'four-agent-id'}),`https://four.meme/zh-TW/token/${token}`);
 assert.equal(protocolUrl({...town,launchProtocol:'gang'}),`https://gang.fun/token/${token}`);
 assert.equal(protocolUrl({...town,token:'../bad'}),undefined);
});
test('Flap reads only Multicall batches at one block and distinguishes historical burn from active burn allocation',async()=>{
 const calls:any[]=[];
 const rpc={getBlockNumber:async()=>123n,getChainId:async()=>56,getBytecode:async()=> '0x1234',multicall:async(options:any)=>{
  calls.push(options);
  if(calls.length===1)return [{marketBps:0,deflationBps:0,lpBps:0,dividendBps:10000,feeRate:100,burntTokenAmount:1000000000000000000n,totalQuoteSentToDividend:2000000000000000000n,minimumShareBalance:10000000000000000000000n,quoteToken:'0x111'},18];
  if(calls.length===2)return [{status:'success',result:{buyTaxRate:100,sellTaxRate:300,dividendToken:'0x222'}}];
  return [18,'WBNB'];
 }};
 const snapshot=await readFlapTax(token,new AbortController().signal,rpc);
 assert.equal(snapshot.buyTaxBps,100);assert.equal(snapshot.sellTaxBps,300);assert.equal(snapshot.minimumHolding,'10000');assert.equal(snapshot.totalDividends,'2');assert.equal(snapshot.totalBurned,'1');assert.equal(snapshot.burnEnabled,false);
 assert.equal(calls.length,3);assert.ok(calls.every(call=>call.blockNumber===123n&&call.multicallAddress===MULTICALL));assert.equal(calls[0].contracts[0].address,FLAP_HELPER);assert.equal(calls[0].contracts[0].functionName,'getTaxTokenInfo');assert.equal(calls[2].contracts[0].address,'0x111');
 assert.equal(townFacilities(withProtocol(town,snapshot)).vault?.status,'confirmed');assert.equal(townFacilities(withProtocol(town,snapshot)).burn,undefined);
});
test('chain or deployment mismatches reject without individual contract fallbacks',async()=>{
 let read=false;const rpc={getBlockNumber:async()=>123n,getChainId:async()=>1,multicall:async()=>{read=true;}};
 await assert.rejects(readFlapTax(token,new AbortController().signal,rpc),/链不匹配/);assert.equal(read,false);
 await assert.rejects(readFlapTax(token,new AbortController().signal,{...rpc,getChainId:async()=>56,getBytecode:async()=>'0x'}),/未部署/);
});
test('Gang keeps missing dividends unknown, binds contract and never infers own-token burning',()=>{
 const snapshot=normalizeGang({address:token,chainId:56,taxed:true,taxBps:100,dividends:{vault:'0xvault',total:'0',quoteSymbol:'BNB'}},token);
 assert.equal(snapshot.dividendEnabled,true);assert.equal(snapshot.totalDividends,'0');assert.equal(snapshot.burnEnabled,undefined);
 assert.equal(normalizeGang({address:token,chainId:56,taxed:true},token).dividendEnabled,undefined);
 assert.throws(()=>normalizeGang({address:'other',chainId:56},token),/不匹配/);
});
test('TagAI raw units are formatted exactly and buybacks are not classified as burns',()=>{
 const snapshot=normalizeTagAI({c:0,d:{config:{token,version:15,source_block:'123'},buyback:{total_index_notified:'1234567890123456789',bnb_reserve:'0'}}},token);
 assert.equal(snapshot.totalDividends,'1.234567890123456789');assert.equal(snapshot.nativeReserve,'0');assert.equal(snapshot.burnEnabled,undefined);
 assert.equal(rawUnits('1000000000000000000000000001',18),'1000000000.000000000000000001');
 assert.equal(withProtocol({...town,token:'other'},snapshot)?.worldCapabilities,undefined);
});

test('Four uses only Multicall at a fixed block, supports distinct buy/sell rates and keeps quote units',async()=>{
 const {readFourTax}=await import('../world/four');
 const calls:any[]=[];const values:any={rateHolder:80n,rateBurn:20n,rateFounder:0n,rateLiquidity:0n,minShare:10000000000000000000000n,quote:'0xquote',decimals:18,buyFeeRate:100n,sellFeeRate:300n,feeHolder:2200000000000000000n,tokenBurned:5000000000000000000n};
 const rpc={getBlockNumber:async()=>456n,getChainId:async()=>56,getBytecode:async()=> '0x1234',multicall:async(options:any)=>{
  calls.push(options);if(calls.length===2)return [18,'WBNB'];
  return options.contracts.map((entry:any)=>values[entry.functionName]==null?{status:'failure'}:{status:'success',result:values[entry.functionName]});
 }};
 const snapshot=await readFourTax(token,new AbortController().signal,rpc);
 assert.equal(snapshot.buyTaxBps,100);assert.equal(snapshot.sellTaxBps,300);assert.equal(snapshot.dividendShareBps,8000);assert.equal(snapshot.totalDividends,'2.2');assert.equal(snapshot.totalBurned,'5');assert.equal(snapshot.burnEnabled,true);
 assert.ok(calls.every(call=>call.multicallAddress===MULTICALL&&call.blockNumber===456n));assert.ok(calls[0].contracts.every((entry:any)=>entry.address===token));
 assert.equal(townFacilities(withProtocol({...town,launchProtocol:'four-agent-id'},snapshot)).burn?.status,'confirmed');
});

test('Gang legacy BSC endpoint can omit chainId but cannot claim a different chain',()=>{
 assert.equal(protocolUrl({...town,launchProtocol:'gang-agent'}),`https://gang.fun/token/${token}`);
 const legacy=normalizeGang({address:token,name:'Gang'},token);
 assert.equal(legacy.taxStatus,'unknown');assert.equal(legacy.dividendEnabled,undefined);
 assert.throws(()=>normalizeGang({address:token,chainId:1},token),/不匹配/);
});
