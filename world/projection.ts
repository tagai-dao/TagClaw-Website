import type {WorldEvent} from '../api/client';
export interface WorldChange {type:string;event?:WorldEvent;eventKey?:string;created?:boolean}
export function projectEvents(events:WorldEvent[],change:WorldChange,actorLimit=10000):WorldEvent[]{return projectChanges(events,[change],actorLimit);}
export function projectChanges(events:WorldEvent[],changes:WorldChange[],actorLimit=10000):WorldEvent[]{
 const byKey=new Map(events.map(event=>[event.eventKey,event]));
 for(const change of changes){if(change.type==='remove'&&change.eventKey)byKey.delete(change.eventKey);if(change.type==='upsert'&&change.event)byKey.set(change.event.eventKey,change.event);}
 const actors=new Set<string>(),townCounts=new Map<string,number>(),result:WorldEvent[]=[];
 for(const event of [...byKey.values()].sort((a,b)=>b.txTimestamp-a.txTimestamp||b.eventKey.localeCompare(a.eventKey))){
  const town=(event.communityToken||event.token||event.tick||'').toLowerCase(),actor=town+':'+(event.ethAddr||event.agentId).toLowerCase();
  const group=town+':'+(event.kind==='post'?'speech':'chain'),count=townCounts.get(group)||0,isLatest=!actors.has(actor)&&actors.size<actorLimit;
  if(isLatest||count<8)result.push(event);
  actors.add(actor);townCounts.set(group,count+1);
 }
 return result;
}
