import {parseAbi,type Abi,type Address} from 'viem';
import {AIPRO,client,abi,api,identities,verifiedIdentities,sameAddress,type Estate,type MiningPool} from './aipro-economy';
import {API_BASE} from '../api/client';
const assetsAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function ipshareBalance(address,address) view returns(uint256)']);
export type Manor={status:'unminted'|'unverified'|'ready';id:number;owner?:string;name?:string;block:bigint;identityTime?:string;info?:Estate;balances?:Record<string,bigint|null>;lp?:{pool:string;amount:bigint|null;decimals:number|null;label:string}[];trades?:any[]|null;warnings:string[]};
export function ownAgentTrades(rows:any[],owner:string){return rows.filter(r=>Number(r.accountType)===3&&sameAddress(r.trader,owner));}
export async function loadManor(id:number,signal:AbortSignal):Promise<Manor>{
 if(!Number.isInteger(id)||id<1||id>3333)throw Error('无效庄园编号');
 const block=await client.getBlockNumber();const read=(address:string,functionName:string,args:unknown[]=[],custom:Abi=abi)=>client.readContract({address:address as Address,abi:custom,functionName,args,blockNumber:block} as any);
 const count=await read(AIPRO.nft,'totalSupply') as bigint;if(BigInt(id)>count)return {status:'unminted',id,block,warnings:[]};
 const info=await read(AIPRO.nft,'getNFTInfo',[BigInt(id)]) as Estate;
 const identity=await identities(signal);const name=verifiedIdentities(identity)[info.owner.toLowerCase()];
 if(!name||sameAddress(info.owner,AIPRO.amm))return {status:'unverified',id,block,warnings:[]};
 const warnings:string[]=[];async function safe<T>(task:()=>Promise<T>,label:string){try{return await task();}catch{warnings.push(label);return null;}}
 const community=await api('/communities/by-token/'+AIPRO.token,signal);if(!sameAddress(community.community,AIPRO.community))throw Error('社区来源不匹配');
 const pools:MiningPool[]=community.pools;
 const [aipro,nfts,bnb,ipshare,pending,lp,trades]=await Promise.all([
 safe(()=>read(AIPRO.token,'balanceOf',[info.owner],assetsAbi),'AIPRO 余额'),safe(()=>read(AIPRO.nft,'balanceOf',[info.owner],assetsAbi),'NFT 持有'),
 safe(()=>client.getBalance({address:info.owner as Address,blockNumber:block}),'BNB 余额'),
 safe(()=>read('0x95450AaD4Cc195e03BB4791B7f6f04aC6D9BA922','ipshareBalance',[info.owner,info.owner],assetsAbi),'IPShare 持有'),
 safe(()=>read(AIPRO.community,'getPoolPendingRewards',[AIPRO.nft,info.owner]),'居民收益'),
 Promise.all(pools.filter(p=>p.poolType==='ERC20_STAKING').map(async p=>({pool:p.pool,decimals:await safe(()=>read(p.asset,'decimals'),'LP 精度') as number|null,label:p.pool.toLowerCase()==='0x04654f23d10116063c04a731f049140c915f5016'?'NVDAB / AIPRO':p.pool.toLowerCase()==='0x8588ece8046377981851caf379bb7c6129cded43'?'SPCXB / AIPRO':p.name,amount:await safe(()=>read(p.pool,'getUserStakedAmount',[info.owner]),'LP 仓位') as bigint|null}))),
 safe(async()=>{const r=await fetch(`${API_BASE}/community/tradeList?token=${AIPRO.token}&pages=0`,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Error();const rows=await r.json();if(!Array.isArray(rows))throw Error();return ownAgentTrades(rows,info.owner);},'交易记录'),
 ]);
 return {status:'ready',id,owner:info.owner,name,block,identityTime:identity.manifest.snapshotTime,info,balances:{aipro:aipro as bigint,nfts:nfts as bigint,bnb,ipshare:ipshare as bigint,pending:pending as bigint},lp,trades,warnings};
}
