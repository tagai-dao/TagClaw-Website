import { API_BASE, type ApiCommunity, type WorldEvent } from '../api/client';
const ORIGIN='https://agent-id.tagai.fun';
export interface AtlasManifest { chainId:number; snapshotBlock:number; identitySnapshotBlock:number; snapshotTime:string; tokens:{address:string;agentWallets:number}[]; }
interface Identity {owner:string;name:string;chainVerified:boolean;block:number}
interface Activity {kind:string;owner:string;name:string;assetId:string;direction:string;amount:string;tx:string;block:number;logIndex:number}
export interface AtlasBundle {manifest:AtlasManifest;agents:Identity[];feed:Activity[]}
let cached:Promise<AtlasBundle>|undefined,expires=0;
async function json(path:string) {
  const response=await fetch(`${import.meta.env?.DEV ? '/atlas-data' : `${API_BASE}/tagclaw/atlas`}${path}`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`ATLAS 快照读取失败（${response.status}）`);
  return response.json();
}
export function atlasBundle():Promise<AtlasBundle> {
  if(!cached||Date.now()>expires){expires=Date.now()+300000;cached=Promise.all([json('/activity/manifest.json'),json('/activity/agents.json'),json('/activity/feed.json')]).then(([manifest,agents,feed])=>{
    if(manifest.chainId!==56||!Number.isSafeInteger(manifest.snapshotBlock)||manifest.identitySnapshotBlock!==manifest.snapshotBlock||!Number.isFinite(Date.parse(manifest.snapshotTime))||!Array.isArray(manifest.tokens)||!Array.isArray(agents)||!Array.isArray(feed))throw new Error('ATLAS 快照格式或链不匹配');
    return {manifest,agents,feed};
  }).catch(error=>{cached=undefined;throw error;});}
  return cached;
}
const blockTimes=new Map<number,number>();
async function blockTime(block:number,signal:AbortSignal):Promise<number> {
  const known=blockTimes.get(block);if(known)return known;
  const response=await fetch('https://bsc-dataseed.binance.org',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({jsonrpc:'2.0',id:block,method:'eth_getBlockByNumber',params:[`0x${block.toString(16)}`,false]})});
  if(!response.ok)throw new Error('BSC 区块时间读取失败');
  const {result}=await response.json();const timestamp=Number(result?.timestamp)*1000;
  if(Number(result?.number)!==block||!Number.isFinite(timestamp)||timestamp<=0)throw new Error('BSC 区块时间无效');
  blockTimes.set(block,timestamp);return timestamp;
}
export async function atlasTownEvents(bundle:AtlasBundle,town:Pick<ApiCommunity,'token'|'tick'>,signal:AbortSignal,readTime=blockTime):Promise<WorldEvent[]> {
  const {manifest,agents,feed}=bundle;
  if(manifest.chainId!==56||manifest.identitySnapshotBlock!==manifest.snapshotBlock||!manifest.tokens.some(item=>item.address.toLowerCase()===town.token?.toLowerCase()))return [];
  const owners=new Map(agents.filter(agent=>agent.chainVerified===true&&agent.block===manifest.identitySnapshotBlock&&agent.name.endsWith('.ai')).map(agent=>[agent.owner.toLowerCase(),agent]));
  const rows=feed.filter(row=>row.kind==='token'&&row.assetId.toLowerCase()===town.token?.toLowerCase()&&owners.get(row.owner.toLowerCase())?.name===row.name&&['buy','sell'].includes(row.direction)&&/^0x[\da-f]{64}$/i.test(row.tx)&&Number.isSafeInteger(row.logIndex)&&row.logIndex>=0&&Number.isSafeInteger(row.block)&&row.block>0&&row.block<=manifest.snapshotBlock).sort((a,b)=>b.block-a.block||b.logIndex-a.logIndex).slice(0,24);
  const result:WorldEvent[]=[];
  // Bounded parallel metadata reads. No balance/contract calls are made here.
  for(let offset=0;offset<rows.length;offset+=4){
    const batch=await Promise.all(rows.slice(offset,offset+4).map(async row=>({
      eventKey:`bsc:${row.tx.toLowerCase()}:${row.logIndex}`,kind:'trade' as const,type:row.direction as 'buy'|'sell',
      agentId:`bsc:${row.owner.toLowerCase()}`,ethAddr:row.owner,name:row.name,username:'',accountType:null,
      identitySource:'atlas-registry' as const,identitySnapshotBlock:manifest.identitySnapshotBlock,snapshotTime:manifest.snapshotTime,
      sourceUrl:`${ORIGIN}/`,blockNumber:row.block,txTimestamp:await readTime(row.block,signal),token:town.token,tick:town.tick,hash:row.tx,logIndex:row.logIndex,amount:row.amount
    })));
    result.push(...batch);
  }
  return result;
}
