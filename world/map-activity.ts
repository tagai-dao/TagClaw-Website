import type {ApiCommunity,WorldEvent} from '../api/client';
import {compareEvents,eventTown,mergeEvents} from './model';

// Keep original event payloads/keys for evidence and cursor handling. Only the map's
// presentation deduplicates an indexed log repeated by multiple public sources.
export function mapActivity(towns:ApiCommunity[],events:WorldEvent[],now=Date.now()):Map<string,WorldEvent[]> {
 const unique=new Map<string,WorldEvent>();
 for(const event of mergeEvents([],events,events.length)){
  if(event.txTimestamp>now)continue;
  const key=event.kind==='post'?`post:${event.tweetId||event.eventKey}`:event.hash&&event.logIndex!=null?`bsc:${event.hash.toLowerCase()}:${event.logIndex}`:event.eventKey;
  const known=unique.get(key);
  if(!known||Number(known.accountType)!==3&&Number(event.accountType)===3)unique.set(key,event);
 }
 const result=new Map<string,WorldEvent[]>();
 for(const event of [...unique.values()].sort(compareEvents)){
  const tick=eventTown(event,towns);if(!tick)continue;
  const rows=result.get(tick)||[];const sameKind=rows.filter(row=>(row.kind==='post')===(event.kind==='post')).length;if(sameKind<8)rows.push(event);result.set(tick,rows);
 }
 return result;
}
export function activityTime(timestamp:number,now=Date.now()):string {
 const age=Math.max(0,now-timestamp);
 if(age<60000)return '刚刚';
 if(age<3600000)return `${Math.floor(age/60000)} 分钟前`;
 if(age<86400000)return `${Math.floor(age/3600000)} 小时前`;
 return new Date(timestamp).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
}
