import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiCommunity, WorldEvent } from '../api/client';
import { mergeEvents } from '../world/model';
import { atlasBundle, atlasTownEvents, type AtlasManifest } from '../world/atlas';
import { townWindow, publicWindow, worldWindow, type WorldSource } from '../world/source';

export function useWorldLife(town?: ApiCommunity | null) {
  const [townEvents,setTownEvents]=useState<WorldEvent[]>([]);
  const [townNotice,setTownNotice]=useState('');
  const [townBusy,setTownBusy]=useState(false);
  const [atlasCoverage,setAtlasCoverage]=useState<AtlasManifest|null>(null);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(!town?.token){setTownNotice('');return;}
    const selectedTown={...town,token:town.token};
    const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),30000);
    setTownBusy(true);setTownNotice(`${selectedTown.tick} · 正在读取社区活动与身份快照…`);
    void (async()=>{
      const results=await Promise.allSettled([
        townWindow(selectedTown,controller.signal),
        atlasBundle().then(async bundle=>{
          if(!active)return {items:[],notice:''};
          setAtlasCoverage(bundle.manifest);
          const covered=bundle.manifest.tokens.some(item=>item.address.toLowerCase()===selectedTown.token.toLowerCase());
          const items=covered?await atlasTownEvents(bundle,selectedTown,controller.signal):[];
          return {items,notice:covered?`ATLAS 链上快照：${selectedTown.tick} 最近 ${items.length} 条成交；快照区块 #${bundle.manifest.snapshotBlock}（${new Date(bundle.manifest.snapshotTime).toLocaleString('zh-CN')}）。身份按该快照核验，非实时账户分类。`:`${selectedTown.tick} 尚未被 ATLAS 活动快照覆盖；公开社区索引为空时，不代表链上没有交易。`};
        })
      ]);
      if(!active)return;
      const [publicResult,atlasResult]=results;
      const incoming=[...(publicResult.status==='fulfilled'?publicResult.value:[]),...(atlasResult.status==='fulfilled'?atlasResult.value.items:[])];
      setTownEvents(previous=>mergeEvents(previous,incoming));
      setTownNotice((atlasResult.status==='fulfilled'?atlasResult.value.notice:`ATLAS 加载失败：${atlasResult.reason instanceof Error?atlasResult.reason.message:'请重试'}。`)+(publicResult.status==='rejected'?' 社区公开索引暂不可用。':''));
    })().finally(()=>{clearTimeout(timeout);if(active)setTownBusy(false);});
    return()=>{active=false;controller.abort();clearTimeout(timeout);};
  },[town?.token,town?.tick,reload]);
  const [events,setEvents] = useState<WorldEvent[]>([]);
  const [source,setSource] = useState<WorldSource | null>(null);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [lastSync,setLastSync] = useState<number | null>(null);
  const [loading,setLoading] = useState(true);
  const [more,setMore] = useState(false);
  const loadedCount=useRef(0);loadedCount.current=events.length;
  const state = useRef({mode:null as WorldSource | null, watermark:0, cursor:null as string | null, busy:false, active:false, generation:0, controller:null as AbortController | null});
  const synchronize = useCallback(async (restart = false) => {
    const current = state.current;
    if (!current.active || current.busy) return;
    current.busy=true;
    const previousMode=current.mode;
    if (restart) { current.mode=null; current.watermark=0; }
    const generation=current.generation;
    const controller=new AbortController(); current.controller=controller;
    const timeout=setTimeout(()=>controller.abort(new Error('索引响应超时')),20000);
    try {
      let page;
      if (current.mode === 'public') page=await publicWindow(controller.signal);
      else {
        try { page=await worldWindow(current.watermark ? {sinceTs:Math.max(0,current.watermark-120000)} : {},controller.signal); }
        catch (failure) {
          if ((failure as {status?:number}).status !== 404) throw failure;
          page=await publicWindow(controller.signal);
        }
      }
      let incoming=page.items;
      if (page.mode === 'world' && current.watermark) {
        const seen = new Set<string>();
        let pending=page;
        while (pending.hasMore && pending.nextCursor) {
          if (seen.has(pending.nextCursor)) throw new Error('活动游标重复，请重试');
          seen.add(pending.nextCursor);
          pending=await worldWindow({sinceTs:Math.max(0,current.watermark-120000),cursor:pending.nextCursor},controller.signal);
          incoming=[...incoming,...pending.items];
        }
      }
      if (!current.active || current.generation!==generation) return;
      const changed=previousMode!==null && previousMode!==page.mode;
      current.mode=page.mode;
      setSource(page.mode);setNotice(page.notice);
      setEvents(previous=>mergeEvents(changed?[]:previous,incoming));
      current.watermark=Math.max(current.watermark,...incoming.map(event=>Number(event.txTimestamp)||0));
      if (!current.cursor || restart || changed) {current.cursor=page.nextCursor;setMore(page.hasMore);}
      setLastSync(Date.now());setError('');
    } catch (failure) {
      if (current.active && current.generation===generation) setError(controller.signal.aborted ? '索引响应超时，请重试' : failure instanceof Error ? failure.message : '连接暂时中断');
    } finally {
      clearTimeout(timeout);
      if (current.generation===generation) {current.busy=false; if(current.active)setLoading(false);}
    }
  },[]);
  useEffect(()=>{
    const current=state.current;current.active=true;current.generation++;
    void synchronize();
    const timer=setInterval(()=>{if(!document.hidden)void synchronize();},8000);
    const visible=()=>{if(!document.hidden)void synchronize();};
    document.addEventListener('visibilitychange',visible);
    return()=>{current.active=false;current.generation++;current.busy=false;current.controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[synchronize]);
  const loadHistory=useCallback(async()=>{
    const current=state.current;
    if(current.busy || !current.cursor || current.mode!=='world')return;
    if(loadedCount.current>=2000){setMore(false);return;}
    current.busy=true;setLoading(true);
    const generation=current.generation;
    const controller=new AbortController();current.controller=controller;
    const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const page=await worldWindow({cursor:current.cursor},controller.signal);
      if(!current.active || current.generation!==generation)return;
      setEvents(previous=>mergeEvents(previous,page.items));current.cursor=page.nextCursor;setMore(page.hasMore);setError('');
    } catch(failure) {if(current.active && current.generation===generation)setError(controller.signal.aborted?'历史记录读取超时，请重试':failure instanceof Error ? failure.message : '历史记录加载失败');}
    finally {clearTimeout(timeout);if(current.generation===generation){current.busy=false;if(current.active)setLoading(false);}}
  },[]);
  return {events:mergeEvents(townEvents,events),source,notice,error,lastSync,loading,more,loadHistory,townNotice,townBusy,atlasCoverage,refresh:()=>{setReload(value=>value+1);void synchronize(true);}};
}
