import {useCallback,useEffect,useRef,useState} from 'react';
import {useWorldRuntime} from './useWorldRuntime';
import type {WorldProfile} from '../world/profile';
const BASE=import.meta.env.VITE_WORLD_API_URL||'/world-data';
const cache=new Map<string,WorldProfile>();
export function useWorldProfile(wallet?:string){
 const key=/^0x[0-9a-f]{40}$/i.test(wallet||'')?wallet!.toLowerCase():'';
 const [profile,setProfile]=useState<WorldProfile|null>(()=>cache.get(key)||null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const generation=useRef(0),lastActivity=useRef('');
 const runtime=useWorldRuntime();
 const activity=runtime.liveEvents.filter(event=>[event.ethAddr,event.sender,event.recipient,event.subject].some(value=>value?.toLowerCase()===key)).at(-1)?.eventKey;
 useEffect(()=>{if(!key||!activity||lastActivity.current===activity)return;lastActivity.current=activity;const timer=setTimeout(()=>setReload(value=>value+1),250);return()=>clearTimeout(timer);},[key,activity]);
 useEffect(()=>{
  const current=++generation.current;setProfile(cache.get(key)||null);setError('');if(!key)return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  const read=async(force=false)=>{
   try{const response=await fetch(`${BASE}/profile/${key}${force?'?refresh=1':''}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw new Error('居民资料服务暂不可用');const value=await response.json() as WorldProfile;if(generation.current!==current||controller.signal.aborted)return;cache.set(key,value);setProfile(value);setError('');timer=setTimeout(()=>void read(),value.state==='pending'||value.refreshing?2500:30000);}
   catch(failure){if(controller.signal.aborted||generation.current!==current)return;setError(failure instanceof Error?failure.message:'居民资料读取失败');timer=setTimeout(()=>void read(),10000);}
  };
  void read(reload>0);return()=>{controller.abort();clearTimeout(timer);};
 },[key,reload]);
 return {profile:profile?.wallet===key?profile:null,error,refresh:useCallback(()=>setReload(value=>value+1),[])};
}
