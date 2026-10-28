import {readWorldJson} from './transport';
import {projectEvents,projectChanges,type WorldChange} from './projection';
import type {ApiCommunity,WorldEvent} from '../api/client';
export interface SourceCoverage {state:string;observedAt?:number;head?:number;indexedBlock?:number;lagBlocks?:number;scope?:string;sources?:number;completeSources?:number;scannedBlocks?:number;registeredIds?:number;httpStatus?:number;complete?:boolean;oldest?:number;events?:number;block?:number;error?:string}
export interface WorldSnapshot {environment?:'test';version:number;cursor:number;towns:ApiCommunity[];events:WorldEvent[];coverage:Record<string,SourceCoverage>;totalEvents:number;generatedAt:number}
export interface RuntimeState {snapshot:WorldSnapshot|null;connected:boolean;available:boolean;error:string;receivedAt:number;liveEvents:WorldEvent[]}
const CACHE='tagclaw-world-snapshot-v1';
const BASE=import.meta.env.VITE_WORLD_API_URL || '/world-data';
let connectionGeneration=0,streamErrors=0,pendingChanges:(WorldChange&{seq:number;historical?:boolean})[]=[],flushTimer:ReturnType<typeof setTimeout>|undefined;
function flushChanges(){
 clearTimeout(flushTimer);flushTimer=undefined;if(!state.snapshot||!pendingChanges.length)return;const batch=pendingChanges;pendingChanges=[];
 const known=new Set(state.snapshot.events.map(event=>event.eventKey));let liveEvents=state.liveEvents,totalEvents=state.snapshot.totalEvents;
 for(const change of batch){if(change.type==='remove'){liveEvents=liveEvents.filter(event=>event.eventKey!==change.eventKey);totalEvents--;}else if(change.event){if(change.created)totalEvents++;if(change.created&&!change.historical&&change.event.txTimestamp<=Date.now()&&change.event.txTimestamp>Date.now()-120000&&!known.has(change.event.eventKey)){liveEvents=[...liveEvents,change.event].slice(-128);known.add(change.event.eventKey);}}}
 publish({...state,snapshot:{...state.snapshot,cursor:batch[batch.length-1].seq,totalEvents,events:projectChanges(state.snapshot.events,batch)},liveEvents,connected:true,receivedAt:Date.now()});persist();
}
let state:RuntimeState={snapshot:null,connected:false,available:false,error:'',receivedAt:0,liveEvents:[]};
try{const cached=JSON.parse(localStorage.getItem(CACHE)||'null');if(cached?.version===1&&Array.isArray(cached.towns)&&Array.isArray(cached.events))state={...state,snapshot:cached};}catch{}
const listeners=new Set<()=>void>();let started=false,source:EventSource|null=null,retry:ReturnType<typeof setTimeout>|undefined,saveTimer:ReturnType<typeof setTimeout>|undefined;
export const runtimeState=()=>state;
export function runtimeSubscribe(listener:()=>void){listeners.add(listener);if(!started){started=true;void connect();}return()=>listeners.delete(listener);}
function publish(next:RuntimeState){state=next;listeners.forEach(fn=>fn());}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{if(state.snapshot)localStorage.setItem(CACHE,JSON.stringify({...state.snapshot,events:state.snapshot.events.slice(0,2500)}));}catch{}},1500);}
export function applyChange(snapshot:WorldSnapshot,change:WorldChange):WorldSnapshot {
 return {...snapshot,totalEvents:snapshot.totalEvents+(change.type==='remove'?-1:change.created?1:0),events:projectEvents(snapshot.events,change)};
}

async function connect(){
 const generation=++connectionGeneration;source?.close();clearTimeout(retry);clearTimeout(flushTimer);pendingChanges=[];
 try{
  const response=await fetch(BASE+'/bootstrap',{signal:AbortSignal.timeout(5000)});
  const snapshot=await readWorldJson(response) as WorldSnapshot;if(generation!==connectionGeneration)return;
  if(snapshot.version!==1||!Array.isArray(snapshot.towns)||!Array.isArray(snapshot.events)||!Number.isSafeInteger(snapshot.cursor))throw new Error('世界快照格式无效');
  publish({...state,snapshot,available:true,connected:false,error:'',receivedAt:Date.now(),liveEvents:[]});persist();
  source=new EventSource(BASE+'/stream?after='+snapshot.cursor);
  source.onopen=()=>{streamErrors=0;publish({...state,connected:true,error:'',receivedAt:Date.now()});};
  source.addEventListener('change',message=>{
   try{
    const seq=Number((message as MessageEvent).lastEventId),change=JSON.parse((message as MessageEvent).data);
    if(generation!==connectionGeneration||!state.snapshot)return;
    const previous=pendingChanges.at(-1)?.seq??state.snapshot.cursor;
    if(seq<=previous)return;
    if(seq!==previous+1){source?.close();void connect();return;}
    pendingChanges.push({...change,seq});if(!flushTimer)flushTimer=setTimeout(flushChanges,100);
   }catch{source?.close();void connect();}
  });
  source.addEventListener('status',message=>{
   try{if(generation!==connectionGeneration)return;flushChanges();const status=JSON.parse((message as MessageEvent).data);if(state.snapshot)publish({...state,snapshot:{...state.snapshot,coverage:status.coverage,towns:status.towns||state.snapshot.towns,totalEvents:status.totalEvents??state.snapshot.totalEvents,generatedAt:status.generatedAt},connected:true,receivedAt:Date.now()});}catch{}
  });
  source.onerror=()=>{if(generation!==connectionGeneration)return;publish({...state,connected:false,error:'实时连接正在恢复，已保存世界仍可浏览'});if(source?.readyState===EventSource.CLOSED||++streamErrors>=3){source?.close();retry=setTimeout(()=>void connect(),1500);}};
 }catch(error){if(generation!==connectionGeneration)return;publish({...state,available:false,connected:false,error:error instanceof Error?error.message:'世界服务未连接'});retry=setTimeout(()=>void connect(),10000);}
}
export const reconnectRuntime=()=>{clearTimeout(retry);void connect();};
export async function runtimeHistory(options:{town?:string;actor?:string;cursor?:string},signal?:AbortSignal):Promise<{items:WorldEvent[];hasMore:boolean;nextCursor:string|null}>{
 const response=await fetch(BASE+'/history?'+new URLSearchParams(Object.fromEntries(Object.entries(options).filter(([,value])=>!!value)) as Record<string,string>),{signal});
 if(!response.ok)throw new Error('世界记忆读取失败');return response.json();
}
