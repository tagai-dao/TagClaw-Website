import {createPublicClient,fallback,http,parseAbi,formatUnits,type Address} from 'viem';
import {bsc} from 'viem/chains';
import {API_BASE} from '../api/client';
import type {AtlasBundle} from './atlas';
export const AIPRO={token:'0xfa81c13f979f0dff4a40b68c4aba147fa0723333',community:'0x67ddb10b8f15a1d87a2237d9b51b97fc00e1fc7f',nft:'0xe86c2e52a5ebaf4afd18020834d5c771aff59cde',amm:'0xa6c5dfcd15f1c2b212bb7b911d7c2ead49cebf3c',trade:'0x551dfc54289f72fd8abc422f8827bad4df01368d'} as const;
export const NUTBOX_URL=`https://nutbox.app/bsc/community/${AIPRO.community}`;
export const sameAddress=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function units(v:unknown,decimals=18){try{return v==null?'待读取':formatUnits(BigInt(String(v)),decimals);}catch{return '待读取';}}
export function verifiedIdentities(bundle:AtlasBundle){
 if(bundle.manifest.chainId!==56||bundle.manifest.identitySnapshotBlock!==bundle.manifest.snapshotBlock)return {};
 return Object.fromEntries(bundle.agents.filter(a=>a.chainVerified&&a.block===bundle.manifest.identitySnapshotBlock&&/^[a-zA-Z0-9-]+\.ai$/.test(a.name)).map(a=>[a.owner.toLowerCase(),a.name]));
}
export interface MiningPool {pool:string;name:string;asset:string;poolType:string;status:string;ratio:number;stakersCount:number;indexBroker?:Record<string,any>}
export interface Operation {index?:number;id?:string;account?:string;user?:string;pool?:string;opType?:string;amountRaw?:string;amount?:string;txHash?:string;opTimestamp?:number;timestamp?:number;orderId?:string}
export interface Estate {id:number;owner:string;level:number;miningWeight:bigint;indexMiningActive:boolean;indexMiningWeight:bigint;pendingIndexRewards:bigint;seed:bigint;ownerPending?:bigint;error?:boolean}
export interface Economy {observedAt:string;block:bigint;pools:MiningPool[];nft:Record<string,any>;lp:Record<string,{active?:boolean;total?:bigint;decimals?:number;symbol?:string;pair?:string;positions?:{address:string;amount:bigint|null}[]}>;history:Operation[]|null;historyMore:boolean;claims:Operation[]|null;claimsTotal:number|null;estates:Estate[];estateTotal:number;identities:Record<string,string>;identityTime?:string;warnings:string[];rewardSummary:Record<string,any>|null}
const client=createPublicClient({chain:bsc,transport:fallback([http('https://bsc-dataseed.binance.org',{batch:true,timeout:10000,retryCount:0}),http('https://bsc-dataseed2.binance.org',{batch:true,timeout:10000,retryCount:0})])});
const abi=parseAbi([
 'function totalSupply() view returns(uint256)','function maxSupply() view returns(uint256)','function renderer() view returns(address)','function indexToken() view returns(address)',
 'function totalActiveIndexMiningWeight() view returns(uint256)','function queuedIndexRewards() view returns(uint256)','function getTotalStakedAmount() view returns(uint256)',
 'function getUserStakedAmount(address) view returns(uint256)',
 'function poolActived(address) view returns(bool)','function getPoolPendingRewards(address,address) view returns(uint256)',
 'function token0() view returns(address)','function token1() view returns(address)',
 'function symbol() view returns(string)','function decimals() view returns(uint8)',
 'function getNFTInfo(uint256) view returns((address owner,uint32 level,uint256 referrerTokenId,uint256 referralCount,uint256 miningWeight,bool miningActive,bool indexMiningActive,uint256 indexMiningWeight,uint256 pendingIndexRewards,uint256 seed,uint256 revealBlock,uint256 revealRound,bool revealPending))',
]);
async function identities(signal:AbortSignal):Promise<AtlasBundle>{
 const read=async (file:string)=>{const r=await fetch(API_BASE+'/tagclaw/atlas/activity/'+file,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});if(!r.ok)throw Error('Identity unavailable');return r.json();};
 const [manifest,agents]=await Promise.all([read('manifest.json'),read('agents.json')]);
 if(manifest.chainId!==56||manifest.identitySnapshotBlock!==manifest.snapshotBlock||!Array.isArray(agents)||!Number.isFinite(Date.parse(manifest.snapshotTime)))throw Error('Invalid identity snapshot');
 return {manifest,agents,feed:[]};
}
async function api(path:string,signal:AbortSignal){const r=await fetch(API_BASE+'/nutbox'+path,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error(path);const b=await r.json();if(b.success!==true)throw Error(path);return b;}
export async function loadEconomy(page:number,signal:AbortSignal):Promise<Economy>{
 const warnings:string[]=[];
 async function optional<T>(fn:()=>Promise<T>,label:string):Promise<T|null>{try{return await fn();}catch{warnings.push(label);return null;}}
 const [community,history,claims,identity,rewardSummary,block]=await Promise.all([
 api('/communities/by-token/'+AIPRO.token,signal),
 optional(()=>api(`/communities/${AIPRO.community}/history?size=100`,signal),'参与记录暂不可用'),
 optional(()=>api(`/communities/${AIPRO.community}/trade-claims/history?pool=${AIPRO.trade}&size=100`,signal),'社交交易领取记录暂不可用'),
 optional(()=>identities(signal),'Agent ID 快照暂不可用'),
 optional(()=>api(`/mining/index-broker-nft-pools/${AIPRO.nft}/index-rewards/24h`,signal),'NFT 收益统计暂不可用'),
 client.getBlockNumber(),
 ]);
 if(!sameAddress(community.community,AIPRO.community)||!sameAddress(community.cToken,AIPRO.token)||!Array.isArray(community.pools))throw Error('社区数据与 AIPRO 地址不匹配');
 const pools:MiningPool[]=community.pools;
 const nftPool=pools.find(p=>sameAddress(p.pool,AIPRO.nft));if(!nftPool)throw Error('未找到已确认的居民 NFT 矿池');
 async function read(address:string,functionName:string,args:unknown[]=[]){return optional(()=>client.readContract({address:address as Address,abi,functionName,args,blockNumber:block} as any),`${functionName} 链上读取失败`);}
 const names=['totalSupply','maxSupply','renderer','indexToken','totalActiveIndexMiningWeight','queuedIndexRewards','getTotalStakedAmount'];
 const values=await Promise.all(names.map(n=>read(AIPRO.nft,n)));
 const nft:Record<string,any>=Object.fromEntries(names.map((n,i)=>[n,values[i]]));
 if(nft.totalSupply==null)throw Error('NFT 总量读取失败，请稍后重试');
 if(nft.indexToken){const [symbol,decimals]=await Promise.all([read(nft.indexToken,'symbol'),read(nft.indexToken,'decimals')]);nft.rewardSymbol=symbol;nft.rewardDecimals=decimals;}
 const lp:Economy['lp']={};
 await Promise.all(pools.filter(p=>p.poolType==='ERC20_STAKING').map(async p=>{
  const [active,total,decimals,symbol]=await Promise.all([read(AIPRO.community,'poolActived',[p.pool]),read(p.pool,'getTotalStakedAmount'),read(p.asset,'decimals'),read(p.asset,'symbol')]);
  const [token0,token1]=await Promise.all([read(p.asset,'token0'),read(p.asset,'token1')]);
  const participants=[...new Set<string>((history?.history||[]).filter((r:Operation)=>sameAddress(r.pool,p.pool)&&['DEPOSIT','WITHDRAW','LOCK'].includes(r.opType||'')).map((r:Operation)=>r.account).filter((a:unknown)=>typeof a==='string'&&/^0x[\da-f]{40}$/i.test(a as string)))].slice(0,30);
  const positions=await Promise.all(participants.map(async address=>({address,amount:await read(p.pool,'getUserStakedAmount',[address]) as bigint|null})));
  const pair=token0&&token1?await Promise.all([read(String(token0),'symbol'),read(String(token1),'symbol')]):[];
  lp[p.pool.toLowerCase()]={active:active as boolean,total:total as bigint,decimals:decimals as number,symbol:symbol as string,positions,pair:pair.length===2&&pair.every(Boolean)?pair.join(' / '):undefined};
 }));
 const estateTotal=Number(nft.totalSupply);
 const ids=Array.from({length:Math.max(0,Math.min(20,estateTotal-page*20))},(_,i)=>estateTotal-page*20-i);
 const estates:Estate[]=await Promise.all(ids.map(async id=>{const info:any=await read(AIPRO.nft,'getNFTInfo',[BigInt(id)]);return info?{id,...info}:{id,owner:'',level:0,miningWeight:0n,indexMiningActive:false,indexMiningWeight:0n,pendingIndexRewards:0n,seed:0n,error:true};}));
 const pending=new Map<string,bigint>();
 await Promise.all([...new Set(estates.filter(e=>!e.error&&!sameAddress(e.owner,AIPRO.amm)).map(e=>e.owner))].map(async owner=>{const value=await read(AIPRO.community,'getPoolPendingRewards',[AIPRO.nft,owner]);if(value!=null)pending.set(owner,value as bigint);}));
 for(const e of estates)e.ownerPending=pending.get(e.owner);
 return {observedAt:new Date().toISOString(),block,pools,nft,lp,history:history?.history??null,historyMore:history?.hasMore??false,claims:claims?.claims??null,claimsTotal:claims?.total??null,estates,estateTotal,identities:identity?verifiedIdentities(identity):{},identityTime:identity?.manifest.snapshotTime,warnings:[...new Set(warnings)],rewardSummary};
}

export async function loadEstateOwner(id:number):Promise<string|null>{
 if(!Number.isInteger(id)||id<1||id>3333)throw Error('Invalid estate');
 const block=await client.getBlockNumber();
 const count=await client.readContract({address:AIPRO.nft,abi,functionName:'totalSupply',blockNumber:block,authorizationList:undefined}) as bigint;
 if(BigInt(id)>count)return null;
 const info=await client.readContract({address:AIPRO.nft,abi,functionName:'getNFTInfo',args:[BigInt(id)],blockNumber:block,authorizationList:undefined}) as {owner:string};
 return info.owner;
}
