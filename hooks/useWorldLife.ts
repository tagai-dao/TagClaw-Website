import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {ApiCommunity,WorldEvent} from '../api/client';
import type {AtlasManifest} from '../world/atlas';
import {mergeEvents} from '../world/model';
import {reconnectRuntime,runtimeHistory} from '../world/runtime';
import {useWorldRuntime} from './useWorldRuntime';

export function useWorldLife(town?:ApiCommunity|null){
 const runtime=useWorldRuntime();
 const [history,setHistory]=useState<WorldEvent[]>([]),[cursor,setCursor]=useState<string|undefined>(),[more,setMore]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setHistory([]);setCursor(undefined);setMore(true);setError('');},[town?.token]);
 const request=useRef<{generation:number;controller?:AbortController}>({generation:0});
 useEffect(()=>{request.current.generation++;request.current.controller?.abort();setBusy(false);return()=>{request.current.generation++;request.current.controller?.abort();};},[town?.token]);
 const loadHistory=useCallback(async()=>{
  if(busy||!more)return;setBusy(true);const generation=request.current.generation;const controller=new AbortController();request.current.controller=controller;
  try{const page=await runtimeHistory({town:town?.token,cursor},controller.signal);if(generation!==request.current.generation)return;setHistory(previous=>mergeEvents(previous,page.items,20000));setCursor(page.nextCursor||undefined);setMore(page.hasMore);setError('');}
  catch(failure){if(generation!==request.current.generation)return;setError(failure instanceof Error?failure.message:'记忆读取失败');}finally{if(generation===request.current.generation)setBusy(false);}
 },[town?.token,cursor,busy,more]);
 const coverage=runtime.snapshot?.coverage,chain=coverage?.chain;
 const historyLabel=coverage?.chainHistory?.state==='backfilling'?`链上历史回填中（${coverage.chainHistory.completeSources||0}/${coverage.chainHistory.sources||0} 个扫描区间）`:coverage?.chainHistory?.state==='complete'?'已适配链上范围回填完成':coverage?.history?.state==='complete'?'TagAI 已索引历史已补齐':coverage?.history?.state==='backfilling'?'历史正在后台补齐':'历史覆盖待确认';
 const notice=runtime.snapshot?`${runtime.snapshot.environment==='test'?'本地测试数据 · 非真实链上记录 · ':''}持久世界快照 · ${runtime.snapshot.totalEvents.toLocaleString()} 条已索引记忆 · ${historyLabel}${chain?.indexedBlock?` · BSC #${chain.indexedBlock}，距链头 ${chain.lagBlocks} 块`:''}。资产和 IPShare 在居民详情按区块读取。`:'正在连接持久世界服务，读取社区目录与居民状态…';
 const events=useMemo(()=>mergeEvents(runtime.snapshot?.events||[],history,20000),[runtime.snapshot?.events,history]);
 return {events,source:'world' as const,notice,error:error||runtime.error,lastSync:runtime.receivedAt||null,loading:!runtime.snapshot||busy,more,loadHistory,townNotice:'',townBusy:false,atlasCoverage:null as AtlasManifest|null,refresh:reconnectRuntime,liveEvents:runtime.liveEvents,connected:runtime.connected,coverage,totalEvents:runtime.snapshot?.totalEvents||0};
}
