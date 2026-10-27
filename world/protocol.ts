import { API_BASE, type ApiCommunity } from '../api/client';
export type LaunchPlatform='flap'|'four'|'gang'|'tagai';
export interface ProtocolSnapshot {
  token:string; platform:LaunchPlatform; sourceUrl:string; observedAt:string; mode:'chain'|'api'|'page-snapshot'; block?:number;
  taxStatus?:'taxed'|'untaxed'|'unknown'; buyTaxBps?:number; sellTaxBps?:number;
  dividendEnabled?:boolean; burnEnabled?:boolean; vault?:string;
  dividendShareBps?:number; burnShareBps?:number;
  dividendAsset?:string; minimumHolding?:string; totalDividends?:string; totalBurned?:string;
  nativeReserve?:string; note?:string;
}
const GANG='0x0c6302401aa5325c2e36f170f52c00b1d220b405';
export function launchPlatform(town:ApiCommunity|null):LaunchPlatform|null {
  if(!town?.token||Number(town.chainId??56)!==56)return null;
  if(town.launchProtocol==='flap-id-agent-curve')return 'flap';
  if(town.launchProtocol==='four-agent-id')return 'four';
  if(['gang','gang-agent'].includes(town.launchProtocol||'')||town.token.toLowerCase()===GANG)return 'gang';
  if([15,16,17].includes(Number(town.version))&&Number(town.isImport||0)===0)return 'tagai';
  return null;
}
export function protocolUrl(town:ApiCommunity|null):string|undefined {
  if(!town?.token||!/^0x[\da-f]{40}$/i.test(town.token))return;
  const token=town.token.toLowerCase();
  switch(launchPlatform(town)){
    case 'flap':return `https://flap.sh/bnb/${token}/taxinfo?lang=zh`;
    case 'four':return `https://four.meme/zh-TW/token/${token}`;
    case 'gang':return `https://gang.fun/token/${token}`;
    case 'tagai':return `${API_BASE}/pump/v${town.version}/detail/${token}`;
  }
}
const finite=(value:unknown):number|undefined=>value!=null&&Number.isFinite(Number(value))?Number(value):undefined;
export function normalizeGang(row:any,token:string,now=new Date().toISOString()):ProtocolSnapshot {
  if(row?.address?.toLowerCase()!==token.toLowerCase()||(row.chainId!=null&&Number(row.chainId)!==56))throw new Error('Gang 返回的代币或链不匹配');
  const taxed=typeof row.taxed==='boolean'?row.taxed:undefined;
  const bps=finite(row.taxBps);
  return {token,platform:'gang',sourceUrl:`https://gang.fun/token/${token}`,observedAt:now,mode:'api',
    taxStatus:taxed===undefined?'unknown':taxed?'taxed':'untaxed',buyTaxBps:bps,sellTaxBps:bps,
    dividendEnabled:taxed===false?false:taxed===true&&!!row.dividends?.vault?true:undefined,
    vault:row.dividends?.vault,dividendAsset:row.dividends?.quoteSymbol,minimumHolding:taxed===true?'10000':undefined,
    totalDividends:row.dividends?.total, note:'来源为 Gang 当前公开索引；分红门槛按协议为持仓超过 10,000 枚。回购 GANG 不等于销毁本代币。'};
}
export function normalizeTagAI(row:any,token:string,now=new Date().toISOString()):ProtocolSnapshot {
  const data=row?.c===0?row.d:null;
  if(data?.config?.token?.toLowerCase()!==token.toLowerCase())throw new Error('TagAI 协议配置不匹配');
  const buyback=data.buyback;
  return {token,platform:'tagai',sourceUrl:`${API_BASE}/pump/v${data.config.version}/detail/${token}`,observedAt:now,mode:'api',
    block:finite(data.config.source_block),dividendEnabled:buyback&&buyback.total_index_notified!=null?true:undefined,
    totalDividends:buyback?.total_index_notified==null?undefined:rawUnits(buyback.total_index_notified,18),
    nativeReserve:buyback?.bnb_reserve==null?undefined:rawUnits(buyback.bnb_reserve,18),
    note:'TagAI 指数回购与持仓分配账本；累计已通知分配不是个人可领取金额。回购不自动视为销毁。'};
}
export function rawUnits(value:string|bigint,decimals:number):string {
  if(!/^\d+$/.test(String(value))||!Number.isInteger(decimals)||decimals<0||decimals>36)throw new Error('无效资产精度');
  const padded=String(value).padStart(decimals+1,'0');
  return decimals?`${padded.slice(0,-decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/,''):padded;
}
async function responseJson(url:string,signal:AbortSignal){const response=await fetch(url,{signal});if(!response.ok)throw new Error(`协议来源读取失败（${response.status}）`);return response.json();}
export async function loadProtocol(town:ApiCommunity,signal:AbortSignal):Promise<ProtocolSnapshot> {
  const platform=launchPlatform(town),token=town.token!.toLowerCase();
  if(platform==='flap')return (await import('./flap')).readFlapTax(token,signal);
  if(platform==='gang')return normalizeGang(await responseJson(`${import.meta.env?.DEV?'/gang-data':`${API_BASE}/tagclaw/protocol/gang`}/tokens/${token}`,signal),token);
  if(platform==='tagai')return normalizeTagAI(await responseJson(protocolUrl(town)!,signal),token);
  if(platform==='four')return (await import('./four')).readFourTax(token,signal);
  throw new Error('当前尚无可自动读取的协议数据，可打开官方 CA 页面查看');
}

export function withProtocol(town:ApiCommunity|null,snapshot:ProtocolSnapshot|null):ApiCommunity|null {
 if(!town||!snapshot||town.token?.toLowerCase()!==snapshot.token.toLowerCase())return town;
 const old=town.worldCapabilities;
 return {...town,worldCapabilities:{...old,taxStatus:snapshot.taxStatus??old?.taxStatus,
  holderDividends:snapshot.dividendEnabled==null?old?.holderDividends:{enabled:snapshot.dividendEnabled,sourceUrl:snapshot.sourceUrl,contract:snapshot.vault},
  autoBurn:snapshot.burnEnabled==null?old?.autoBurn:{enabled:snapshot.burnEnabled,mechanism:'tax-burn',sourceUrl:snapshot.sourceUrl}
 }};
}
