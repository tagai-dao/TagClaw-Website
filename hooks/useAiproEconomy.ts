import {useEffect,useState} from 'react';
import {loadEconomy,type Economy} from '../world/aipro-economy';
export function useAiproEconomy(enabled:boolean){
 const [data,setData]=useState<Economy|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!enabled)return;let active=true;const c=new AbortController();setLoading(true);setError('');setData(null);
 loadEconomy(page,c.signal).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError('小镇账本暂时无法读取，请重试；读取失败不代表余额为零。');}).finally(()=>{if(active)setLoading(false);});
 return()=>{active=false;c.abort();};},[enabled,page,revision]);
 useEffect(()=>{if(!enabled)return;const timer=setInterval(()=>{if(!document.hidden)setRevision(v=>v+1);},60000);return()=>clearInterval(timer);},[enabled]);
 return {data,error,loading,page,setPage,refresh:()=>setRevision(v=>v+1)};
}
