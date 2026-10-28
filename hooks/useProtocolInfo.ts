import {useEffect,useState} from 'react';
import type {ApiCommunity} from '../api/client';
import {launchPlatform,loadProtocol,type ProtocolSnapshot} from '../world/protocol';
const cache=new Map<string,ProtocolSnapshot>();
export function useProtocolInfo(town:ApiCommunity|null){
 const key=town?.token?.toLowerCase()||'';
 const [snapshot,setSnapshot]=useState<ProtocolSnapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{
  setSnapshot(null);setError('');
  if(!town||!launchPlatform(town)){setLoading(false);return;}
  const cached=cache.get(key);if(cached)setSnapshot(cached);
  let active=true;const controller=new AbortController();setLoading(true);
  const timeout=setTimeout(()=>controller.abort(),45000);
  loadProtocol(town,controller.signal).then(result=>{if(active){cache.set(key,result);setSnapshot(result);setError('');}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'协议读取失败');}).finally(()=>{clearTimeout(timeout);if(active)setLoading(false);});
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[key,town?.launchProtocol,town?.version,reload]);
 useEffect(()=>{if(!key)return;const timer=setInterval(()=>{if(!document.hidden)setReload(value=>value+1);},60000);return()=>clearInterval(timer);},[key]);
 return {snapshot:snapshot?.token.toLowerCase()===key?snapshot:null,error,loading,refresh:()=>setReload(value=>value+1)};
}
