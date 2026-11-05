import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TownEconomy from '../components/world/TownEconomy';
import {MemoryRouter} from 'react-router-dom';
import {AIPRO,verifiedIdentities,units,sameAddress,type Economy} from '../world/aipro-economy';
import {route} from '../world/island-path';
const owner='0x0000000000000000000000000000000000000001';
const data:Economy={observedAt:'2026-11-05T00:00:00Z',block:10n,pools:[{pool:AIPRO.nft,name:'AIPRO',asset:AIPRO.token,poolType:'INDEX_BROKER_NFT',status:'OPENED',ratio:1000,stakersCount:0}],nft:{totalSupply:1n,maxSupply:3333n,totalActiveIndexMiningWeight:5n*10n**18n,queuedIndexRewards:0n,getTotalStakedAmount:10000n,rewardSymbol:'CyberCab',rewardDecimals:18},lp:{},history:[],historyMore:false,claims:[],claimsTotal:0,estates:[{id:1,owner,level:1,miningWeight:10000n,indexMiningActive:true,indexMiningWeight:5n*10n**18n,pendingIndexRewards:2n*10n**18n,seed:1n,ownerPending:3n*10n**18n}],estateTotal:1,identities:{[owner]:'farmer.ai'},warnings:[],rewardSummary:null};
function render(kind:string,d=data){return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(TownEconomy,{kind,state:{data:d,error:'',loading:false,page:0,setPage:()=>{},refresh:()=>{}}})));}
test('missing balances stay unknown; zero and precise raw amounts remain distinct',()=>{assert.equal(units(null),'待读取');assert.equal(units(0n),'0');assert.equal(units(1000000000000000001n),'1.000000000000000001');assert.ok(sameAddress(AIPRO.nft,AIPRO.nft.toUpperCase()));});
test('only verified identities from the matching snapshot become .ai labels',()=>{const agents=[{owner,name:'farmer.ai',chainVerified:true,block:10},{owner:'bad',name:'fake.ai',chainVerified:false,block:10},{owner:'old',name:'old.ai',chainVerified:true,block:9}];assert.deepEqual(verifiedIdentities({agents,manifest:{chainId:56,snapshotBlock:10,identitySnapshotBlock:10,snapshotTime:'',tokens:[]},feed:[]}),{[owner]:'farmer.ai'});});
test('two farm ledgers do not mix AIPRO holder rewards with CyberCab staking rewards',()=>{const stake=render('质押农田'),holder=render('居民农田');assert.match(stake,/质押 5 AIPRO/);assert.match(stake,/待领取 2 CyberCab/);assert.doesNotMatch(stake,/持有者合计待领取/);assert.match(holder,/持有者合计待领取 3 AIPRO/);assert.doesNotMatch(holder,/待领取 2 CyberCab/);});
test('hall keeps future ETF dividends separate and excludes AMM identity from residents',()=>{const hall=render('市政厅',{...data,estates:[{...data.estates[0],owner:AIPRO.amm}]});assert.match(hall,/市政收益 · 待开启/);assert.match(hall,/NFT AMM 库存 · 暂无居民/);assert.doesNotMatch(hall,/farmer.ai/);});
test('unavailable claim records are not rendered as zero participation',()=>{const html=render('小镇动态',{...data,claims:null,claimsTotal:null});assert.match(html,/记录暂不可用/);assert.match(html,/待读取/);});
test('both farm doors are reachable from the town spawn',()=>{for(const door of [{x:54,y:62},{x:55,y:63}])assert.ok(route({x:75,y:62},door).length>0);});
