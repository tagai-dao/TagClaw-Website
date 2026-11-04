import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {ApiCommunity,WorldEvent} from '../../api/client';
import {launchPlatform,type LaunchPlatform} from '../../world/protocol';
import IslandGround from './IslandGround';
import {zoomMap} from '../../world/map-camera';
import {mapActivity,activityTime} from '../../world/map-activity';
import {eventSentence,eventContent,eventTown,stableHash} from '../../world/model';

type Continent=LaunchPlatform|'unmapped';
export const continentNames:Record<Continent,string>={gang:'GANG 岛',flap:'Flap 岛',four:'Four 岛',tagai:'TagAI 岛',unmapped:'散落的星星岛'};
const atlasWidth=1680,atlasHeight=930;
const geography:{key:Continent;x:number;y:number;width:number;height:number}[]=[
 {key:'gang',x:350,y:225,width:480,height:230},
 {key:'flap',x:1250,y:250,width:540,height:240},
 {key:'four',x:360,y:680,width:490,height:210},
 {key:'tagai',x:1260,y:710,width:510,height:200},
 {key:'unmapped',x:758,y:807,width:100*Math.sqrt(5),height:56*Math.sqrt(5)},
];
export default function WorldAtlas({towns,events,coveredTokens,onTown,onEvent,bubbles=true,activityStatus}:{towns:ApiCommunity[];events:WorldEvent[];coveredTokens:string[];onTown:(tick:string)=>void;onEvent:(event:WorldEvent)=>void;bubbles?:boolean;activityStatus?:string}){
 const [camera,setCamera]=useState({zoom:1,x:0,y:0}),[size,setSize]=useState({width:1400,height:1060}),[now,setNow]=useState(Date.now());
 const [selectedIsland,selectIsland]=useState<Continent|null>(null);
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;originX:number;originY:number}|null>(null),moved=useRef(false);
 const fit=Math.min(size.width/atlasWidth,size.height/atlasHeight),scale=fit*camera.zoom;
 const mapWidth=size.width/fit,mapHeight=size.height/fit;
 const left=(size.width-mapWidth*scale)/2+camera.x,top=(size.height-mapHeight*scale)/2+camera.y;
 useEffect(()=>{
  const node=viewport.current;if(!node)return;
  const observer=new ResizeObserver(([entry])=>{setSize({width:entry.contentRect.width,height:entry.contentRect.height});setCamera({zoom:1,x:0,y:0});});observer.observe(node);
  const wheel=(event:WheelEvent)=>{event.preventDefault();const bounds=node.getBoundingClientRect(),x=event.clientX-bounds.left-bounds.width/2,y=event.clientY-bounds.top-bounds.height/2;setCamera(previous=>zoomMap(previous,event.deltaY,x,y));};
  node.addEventListener('wheel',wheel,{passive:false});return()=>{observer.disconnect();node.removeEventListener('wheel',wheel);};
 },[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const recent=useMemo(()=>mapActivity(towns,events),[towns,events]);
 const groups=useMemo(()=>{
  const result=new Map<Continent,ApiCommunity[]>(geography.map(region=>[region.key,[]]));
  for(const town of [...towns].sort((a,b)=>(a.worldPositionIndex??0)-(b.worldPositionIndex??0)||(a.token||a.tick).localeCompare(b.token||b.tick)))result.get(launchPlatform(town)||'unmapped')!.push(town);
  return result;
 },[towns]);
 const activity=useMemo(()=>{
  const result=new Map<string,Set<string>>();
  for(const event of events){const tick=eventTown(event,towns);if(!tick)continue;if(!result.has(tick))result.set(tick,new Set());result.get(tick)!.add(event.ethAddr?.toLowerCase()||event.agentId);}
  return result;
 },[events,towns]);
 const regions=geography.filter(region=>region.key!=='unmapped'||groups.get(region.key)!.length);
 const locations=regions.flatMap(region=>{
   const all=groups.get(region.key)!;
   if(!all.length)return [];
   const columns=Math.min(all.length,Math.ceil(Math.sqrt(all.length*region.width/region.height)));
   const rows=Math.ceil(all.length/columns);
   const dx=region.width/columns,dy=region.height/rows;
   const diameter=Math.min(68,dx*.82,dy*.82);
   return all.map((town,i)=>{
     const row=Math.floor(i/columns),inRow=Math.min(columns,all.length-row*columns);
     return {town,diameter,x:region.x+(i%columns-(inRow-1)/2)*dx,y:region.y+(row-(rows-1)/2)*dy};
   });
 });
 const selectedTowns=selectedIsland?groups.get(selectedIsland)||[]:[];
 return <section className="world-atlas planet-atlas" aria-label="社区群岛世界地图">
  <div className={`planet-viewport is-camera ${camera.zoom>1?'is-zoomed':''}`} ref={viewport} tabIndex={0} aria-label="群岛地图：滚轮缩放，放大后拖动，双击恢复全景" onDoubleClick={()=>setCamera({zoom:1,x:0,y:0})} onKeyDown={event=>{if(event.key==='Escape'||event.key==='0')setCamera({zoom:1,x:0,y:0});}}
   onPointerDown={event=>{if(event.button!==0)return;moved.current=false;drag.current={x:event.clientX,y:event.clientY,originX:camera.x,originY:camera.y};}}
   onPointerMove={event=>{if(!drag.current||camera.zoom===1)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.hypot(dx,dy)<5)return;moved.current=true;event.currentTarget.setPointerCapture(event.pointerId);setCamera(previous=>({...previous,x:drag.current!.originX+dx,y:drag.current!.originY+dy}));}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onClickCapture={event=>{if(moved.current){event.preventDefault();event.stopPropagation();moved.current=false;}}}>
   <div className="planet-map" style={{width:mapWidth,height:mapHeight,left,top,transform:`scale(${scale})`}}>
   <IslandGround src="/town/world-atlas.webp"/>
   <svg className="star-island-ground" viewBox="0 0 100 56" aria-hidden="true" style={{position:'absolute',left:(758-50*Math.sqrt(5))/atlasWidth*100+'%',top:(807-28*Math.sqrt(5))/atlasHeight*100+'%',width:100*Math.sqrt(5)/atlasWidth*100+'%',height:56*Math.sqrt(5)/atlasHeight*100+'%',pointerEvents:'none'}}>
    <path d="M8 20H20V12H38V4H63V10H80V18H94V36H84V46H66V52H35V46H18V38H8Z" fill="#467898" stroke="#b7eff0" strokeWidth="3"/>
    <path d="M10 18H24V10H44V4H64V10H79V17H90V32H80V40H63V46H37V40H23V33H10Z" fill="#91b85d" stroke="#e8d99b" strokeWidth="3"/>
    <path d="m48 12 4 9 10 1-8 6 2 10-9-6-9 5 2-10-7-7 10 1Z" fill="#f8de83"/>
   </svg>
   {regions.map(region=><button key={region.key} className="island-sign" style={{left:region.x/atlasWidth*100+'%',top:(region.y-region.height/2-40)/atlasHeight*100+'%'}} onClick={()=>selectIsland(region.key)}>{continentNames[region.key]} · {groups.get(region.key)!.length}</button>)}
   {locations.map(({town,x,y,diameter})=>{const count=activity.get(town.tick)?.size||0,rows=recent.get(town.tick)||[],latest=rows.find(row=>row.kind!=='post'),speech=rows.find(row=>row.kind==='post');return <div key={town.token||town.tick} className="planet-community town-marker" style={{width:diameter,height:diameter,left:`${x/atlasWidth*100}%`,top:`${y/atlasHeight*100}%`}}>
    {bubbles&&(latest||speech)&&<div className="planet-island-bubbles">{[latest,speech].filter((item):item is WorldEvent=>!!item).map(latest=><button key={latest.eventKey} className={`planet-activity-bubble ${latest.kind==='post'?'is-speech':'is-transaction'}`} aria-label={`查看 ${town.tick} 的最新${latest.kind==='post'?'发言':'链上动态'}：${eventSentence(latest)}`} onClick={()=>onEvent(latest)}>
      <span key={latest.eventKey} className="map-bubble-content"><span className="map-bubble-meta"><b>{latest.kind==='post'?'发言':'链上动态'}</b><time dateTime={new Date(latest.txTimestamp).toISOString()}>{latest.identitySource==='atlas-registry'?(latest.chainSource==='nodereal'?'身份快照 · ':'历史快照 · '):''}{activityTime(latest.txTimestamp,now)}</time></span>
      <span className="map-bubble-text">{latest.kind==='post'?`${latest.contentSource==='x'?`关联 X @${latest.xHandle}`:latest.name}：${eventContent(latest)||'发布了公开内容'}`:eventSentence(latest)}</span><span className="map-bubble-more">查看详情 ↗</span></span>
     </button>)}</div>}
    <button className="token-pin" title={town.tick+' · '+(town.name||town.tick)} onClick={()=>onTown(town.tick)} aria-label={`进入 ${town.tick} 小镇`} style={{backgroundColor:`hsl(${stableHash(town.tick)%360} 44% 35%)`,fontSize:diameter*.38}}>
      <span aria-hidden="true">{Array.from(town.tick).slice(0,2).join('')}</span>
      {town.logo&&<img key={town.logo} src={town.logo} alt="" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true;}}/>}
      {(count>0||coveredTokens.includes(town.token?.toLowerCase()||''))&&<i className="token-activity" aria-hidden="true"/>}
    </button>
   </div>;})}
  </div></div>
  <div className="island-toolbar" aria-label="选择平台岛屿">{regions.map(r=><button key={r.key} onClick={()=>selectIsland(r.key)}>{continentNames[r.key]}</button>)}</div>
  {selectedIsland&&<aside className="island-manifest" aria-label="岛屿代币目录"><button className="manifest-close" aria-label="关闭目录" onClick={()=>selectIsland(null)}>×</button><h3>{continentNames[selectedIsland]}</h3>
    <p>{selectedTowns.length} 座小镇</p>{selectedTowns.map(t=><button key={t.token||t.tick} onClick={()=>onTown(t.tick)}>{t.tick} ↗</button>)}{!selectedTowns.length&&<small>暂无已载入代币</small>}</aside>}
  <footer className="planet-legend"><span><i className="legend-live"/> 已载入活动</span><span><i/> 社区小镇 · 点击进入</span><small>滚轮缩放 · 拖动探索 · 双击恢复全景</small></footer>
 </section>;
}
