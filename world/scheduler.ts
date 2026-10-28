import type {WorldEvent} from '../api/client';
export interface SceneAction {event:WorldEvent;count:number;startedAt:number;endsAt:number}
export const actorKey=(event:WorldEvent)=>event.ethAddr?.toLowerCase()||event.agentId;
export class SceneScheduler {
 private seen=new Set<string>();
 readonly actions=new Map<string,SceneAction>();
 seed(events:WorldEvent[]){events.forEach(event=>this.seen.add(event.eventKey));}
 receive(events:WorldEvent[],now:number){
  const retained=new Set(events.map(event=>event.eventKey));
  for(const [key,action] of this.actions)if(!retained.has(action.event.eventKey))this.actions.delete(key);
  for(const event of [...events].sort((a,b)=>a.txTimestamp-b.txTimestamp||a.eventKey.localeCompare(b.eventKey))){
   if(this.seen.has(event.eventKey))continue;this.seen.add(event.eventKey);
   if(now-event.txTimestamp>120000||event.txTimestamp>now)continue;
   const key=actorKey(event),previous=this.actions.get(key);
   if(previous&&previous.event.txTimestamp>event.txTimestamp)continue;
   this.actions.set(key,{event,count:previous&&previous.endsAt>now?previous.count+1:1,startedAt:previous&&previous.endsAt>now?previous.startedAt:now,endsAt:now+(event.kind==='post'?16000:8500)});
  }
  this.expire(now);
  if(this.seen.size>20000)this.seen=new Set([...this.seen].slice(-10000));
 }
 expire(now:number){for(const [key,action] of this.actions)if(action.endsAt<=now)this.actions.delete(key);}
}

export type ScenePoint={x:number;y:number};
// Travel along the public street between observed venues; no invented financial action.
export function walkPosition(from:ScenePoint,to:ScenePoint,elapsed:number,duration=2400):ScenePoint {
 if(elapsed>=duration)return to;if(elapsed<=0)return from;
 const points=[from,{x:from.x,y:350},{x:to.x,y:350},to];
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
 let remaining=lengths.reduce((sum,n)=>sum+n,0)*elapsed/duration;
 for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]&&lengths[i]>0){const t=remaining/lengths[i];return {x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}remaining-=lengths[i];}
 return to;
}
