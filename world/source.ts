import { API_BASE, getWorldFeed, type ApiTweet, type WorldEvent, type WorldFeedResponse } from '../api/client';

export type WorldSource = 'world' | 'public';
export interface WorldWindow extends WorldFeedResponse { mode: WorldSource; notice: string; }
interface PublicTrade {
  accountType?: number; twitterId?: string; trader?: string; twitterName?: string; twitterUsername?: string; profile?: string;
  timestamp: number; transHash?: string; logIndex?: number; isBuy?: boolean | number; tick?: string; token?: string;
  amount?: number; ethAmount?: number; tradeMarketCapUsd?: number; amountUsd?: number; quoteAmountUsd?: number; eventNativeUsd?: number;
}
async function publicRows<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const response = await fetch(`${API_BASE}${path}`, { signal });
  if (!response.ok) throw new Error(`公开索引不可用（${response.status}）`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('公开索引返回了无效数据');
  return rows;
}
export function publicTradeEvent(row: PublicTrade): WorldEvent | null {
  if (Number(row.accountType) !== 3 || !row.twitterId || !row.transHash) return null;
  // A missing log index is ambiguous; do not collapse unrelated logs into a made-up event.
  if (!Number.isInteger(Number(row.logIndex)) || row.logIndex == null) return null;
  const buy = row.isBuy === true || Number(row.isBuy) === 1;
  return { eventKey: `bsc:${row.transHash.toLowerCase()}:${row.logIndex}`, kind:'trade', type:buy?'buy':'sell',
    agentId:row.twitterId, accountType:3, ethAddr:row.trader || '', name:row.twitterName || row.twitterUsername || row.twitterId,
    username:row.twitterUsername || '', profile:row.profile, txTimestamp:Number(row.timestamp)*1000,
    tick:row.tick, token:row.token, amount:row.amount, ethAmount:row.ethAmount, hash:row.transHash,
    logIndex:row.logIndex, tradeMarketCapUsd:row.tradeMarketCapUsd, amountUsd:row.amountUsd ?? row.quoteAmountUsd,
    eventNativeUsd:row.eventNativeUsd };
}
export function publicPostEvent(row: ApiTweet): WorldEvent | null {
  const time = Date.parse(row.tweetTime);
  if (Number(row.accountType) !== 3 || !row.twitterId || !row.tweetId || !Number.isFinite(time)) return null;
  return { eventKey:`public-post:${row.tweetId}`,kind:'post',type:'post',agentId:String(row.twitterId),accountType:3,
    ethAddr:row.ethAddr || '',name:row.twitterName || row.twitterUsername || String(row.twitterId),username:row.twitterUsername || '',
    profile:row.profile,txTimestamp:time,tweetId:String(row.tweetId),content:row.content,tick:row.tick,token:row.token,contentSource:'indexed' };
}
export async function publicWindow(signal?: AbortSignal): Promise<WorldWindow> {
  const tradePages = await Promise.all([0,1].map(page => publicRows<PublicTrade>(`/community/tradeFeed?pages=${page}`, signal)));
  const postPages = await Promise.allSettled([0,1].map(page => publicRows<ApiTweet>(`/tweets/byTime?pages=${page}`, signal)));
  const postsAvailable = postPages.every(page => page.status === 'fulfilled');
  const items = [...tradePages.flat().map(publicTradeEvent), ...postPages.flatMap(page => page.status === 'fulfilled' ? page.value.map(publicPostEvent) : [])]
    .filter((row): row is WorldEvent => row !== null);
  return { success:true,items,hasMore:false,nextCursor:null,mode:'public',coverage:'公开交易与内容索引最近两页，仅 account_type=3',
    notice:`公开索引窗口：只覆盖最近两页已收录买卖${postsAvailable ? '与公开内容' : '；内容接口暂不可用'}。当前不含 Claim、转账和更早历史。` };
}
export async function worldWindow(options: {cursor?: string; sinceTs?: number; limit?: number} = {}, signal?: AbortSignal): Promise<WorldWindow> {
  const result = await getWorldFeed({...options,limit:options.limit || 100}, signal);
  return {...result,mode:'world',notice:result.environment==='test'?'本地测试数据 · 用于验证气泡、动作与历史回放，不是真实链上记录。':'已连接动态服务 · 每 8 秒检查新事件；持仓与 IPShare 快照尚未接入。'};
}

export async function publicTownWindow(town:{token:string;tick:string},signal?:AbortSignal):Promise<WorldEvent[]> {
  const results=await Promise.allSettled([
    publicRows<PublicTrade>(`/community/tradeList?token=${encodeURIComponent(town.token)}&pages=0`,signal),
    publicRows<ApiTweet>(`/curation/communityTweets?tick=${encodeURIComponent(town.tick)}&pages=0`,signal)
  ]);
  if(results.every(result=>result.status==='rejected'))throw new Error('社区活动索引暂不可用');
  return results.flatMap((result,index)=>result.status==='fulfilled'?result.value.map(row=>index===0?publicTradeEvent(row as PublicTrade):publicPostEvent(row as ApiTweet)).filter((row):row is WorldEvent=>!!row&&(!row.token||row.token.toLowerCase()===town.token.toLowerCase())).map(row=>({...row,token:town.token,tick:town.tick})):[]);
}

export async function townWindow(town:{token:string;tick:string},signal?:AbortSignal):Promise<WorldEvent[]> {
  try {
    const result=await getWorldFeed({tick:town.tick,limit:100},signal);
    return result.items.filter(row=>Number(row.accountType)===3&&(!row.token||row.token.toLowerCase()===town.token.toLowerCase()));
  } catch(error) {
    if((error as {status?:number}).status!==404)throw error;
    return publicTownWindow(town,signal);
  }
}
