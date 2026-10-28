import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {ApiCommunity,WorldEvent} from '../../api/client';
import {launchPlatform,type LaunchPlatform} from '../../world/protocol';
import {zoomMap} from '../../world/map-camera';
import {mapActivity,activityTime} from '../../world/map-activity';
import {eventSentence,eventContent,plainContent,eventTown,stableHash} from '../../world/model';

type Continent=LaunchPlatform|'unmapped';
export const continentNames:Record<Continent,string>={gang:'GANG 洲',flap:'Flap 洲',four:'Four 洲',tagai:'TagAI 洲',unmapped:'待归属群岛'};
const geography:{key:Continent;color:string;shore:string;label:[number,number];slots:[number,number][];path:string}[]=[
 {key:'gang',color:'#c7d7a5',shore:'#a7bf87',label:[295,90],slots:[[225,245],[425,305],[385,170],[190,365],[510,400]],path:'M109 160Q73 120 151 100L234 119Q277 57 335 112L419 100Q451 126 460 161L533 186Q569 229 520 264L547 315Q512 360 455 342L413 401Q363 435 322 395L268 422Q239 389 252 355L186 329Q132 343 109 303L133 252Q87 225 109 160Z'},
 {key:'flap',color:'#c4d8bc',shore:'#9cba9d',label:[1040,60],slots:[[830,205],[1025,185],[1215,235],[790,360],[985,345],[1190,385],[1060,500],[1260,490],[870,490]],path:'M738 154L789 114Q840 141 886 112L946 143Q1006 79 1062 119L1147 102L1182 150Q1274 128 1301 182L1288 226L1344 281Q1341 340 1294 350L1310 414Q1260 445 1223 422L1188 494Q1160 550 1101 527L1054 565L999 528Q959 507 978 462L917 434L865 464L812 419L754 434Q711 408 743 354L689 306Q680 257 730 244L708 195Z'},
 {key:'four',color:'#e5d4a1',shore:'#c9b57c',label:[405,505],slots:[[280,635],[465,650],[355,790],[545,790],[230,765],[480,905]],path:'M214 568Q247 523 293 556L359 534L409 572Q472 547 501 594L560 601L581 649L623 696Q652 742 600 770L604 829L552 872Q512 847 477 896L418 918L379 870L320 884L288 832L232 817Q207 788 236 750L197 697Q162 660 199 627Z'},
 {key:'tagai',color:'#d4cbdc',shore:'#b6a7c3',label:[1115,655],slots:[[1110,800],[960,820],[1245,840],[1080,930]],path:'M926 742Q910 690 970 698L1035 714Q1081 675 1130 717L1184 698L1219 746L1286 767Q1340 818 1296 861L1301 914L1232 946L1189 924L1123 967Q1078 974 1050 932L981 940L958 892L904 872Q878 829 923 797Z'},
 {key:'unmapped',color:'#d2d7c4',shore:'#b1bda5',label:[752,800],slots:[[745,905],[815,1000]],path:'M678 883Q690 848 728 858L762 847L794 875L830 888L821 936L785 962L735 948L700 970L667 938Z'}
];
// A wider composition uses the viewport for land rather than letterboxed sea.
const atlasWidth=1680,atlasHeight=930;
const framing:Record<Continent,{x:number;y:number;spread:number}>={gang:{x:0,y:-30,spread:1.08},flap:{x:230,y:-20,spread:1.1},four:{x:-30,y:-80,spread:1.1},tagai:{x:210,y:-65,spread:1.05},unmapped:{x:40,y:-100,spread:1}};
const labelPosition=(region:typeof geography[number]):[number,number]=>region.key==='tagai'?[1515,570]:region.key==='unmapped'?[792,650]:[region.label[0]+framing[region.key].x,region.label[1]+framing[region.key].y];
const framedX=(region:typeof geography[number],x:number)=>region.label[0]+(x-region.label[0])*framing[region.key].spread+framing[region.key].x;
function Settlement({x,y,color}:{x:number;y:number;color:string}){
 return <g transform={`translate(${x} ${y})`}><ellipse cy="18" rx="67" ry="27" fill={color} opacity=".55"/><path d="M-61 22Q0 44 59 19" stroke="#fbf5d5" strokeWidth="3" fill="none" opacity=".6"/>{[-29,0,28].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i===1?-7:0})`}><rect x="-10" y="-8" width="20" height="22" rx="2" fill="#fff3d7"/><path d="M-15-7L0-20 15-7Z" fill={i===1?'#ba8865':'#829a76'}/><rect x="-3" y="3" width="6" height="11" rx="1" fill="#92836a"/></g>)}</g>;
}
export default function WorldAtlas({towns,events,coveredTokens,onTown,onEvent,bubbles=true,activityStatus}:{towns:ApiCommunity[];events:WorldEvent[];coveredTokens:string[];onTown:(tick:string)=>void;onEvent:(event:WorldEvent)=>void;bubbles?:boolean;activityStatus?:string}){
 const [camera,setCamera]=useState({zoom:1,x:0,y:0}),[size,setSize]=useState({width:1400,height:1060}),[now,setNow]=useState(Date.now());
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;originX:number;originY:number}|null>(null),moved=useRef(false);
 const fit=Math.min(size.width/atlasWidth,size.height/atlasHeight),scale=fit*camera.zoom;
 const left=(size.width-atlasWidth*scale)/2+camera.x,top=(size.height-atlasHeight*scale)/2+camera.y;
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
 const locations=regions.flatMap(region=>groups.get(region.key)!.map((town,index)=>{
  const base=region.slots[index%region.slots.length],extra=Math.floor(index/region.slots.length);
  return {town,region,x:framedX(region,base[0]+extra*24),y:base[1]+extra*70+framing[region.key].y};
 }));
 return <section className="world-atlas planet-atlas" aria-label="社区群岛世界地图">
  <div className={`planet-viewport is-camera ${camera.zoom>1?'is-zoomed':''}`} ref={viewport} tabIndex={0} aria-label="群岛地图：滚轮缩放，放大后拖动，双击恢复全景" onDoubleClick={()=>setCamera({zoom:1,x:0,y:0})} onKeyDown={event=>{if(event.key==='Escape'||event.key==='0')setCamera({zoom:1,x:0,y:0});}}
   onPointerDown={event=>{if(event.button!==0)return;moved.current=false;drag.current={x:event.clientX,y:event.clientY,originX:camera.x,originY:camera.y};}}
   onPointerMove={event=>{if(!drag.current||camera.zoom===1)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.hypot(dx,dy)<5)return;moved.current=true;event.currentTarget.setPointerCapture(event.pointerId);setCamera(previous=>({...previous,x:drag.current!.originX+dx,y:drag.current!.originY+dy}));}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onClickCapture={event=>{if(moved.current){event.preventDefault();event.stopPropagation();moved.current=false;}}}>
   <div className="planet-map" style={{width:atlasWidth,height:atlasHeight,left,top,transform:`scale(${scale})`}}>
   <svg viewBox="0 0 1680 930" className="planet-geography" aria-hidden="true">
    <defs><radialGradient id="atlas-sea"><stop stopColor="var(--tagclaw-map-water-center)"/><stop offset="1" stopColor="var(--tagclaw-map-water-edge)"/></radialGradient><pattern id="atlas-water" width="90" height="70" patternUnits="userSpaceOnUse"><path d="M8 35q8-5 16 0t16 0" fill="none" stroke="#b9a481" strokeWidth="1" opacity=".2"/></pattern><filter id="atlas-coast-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="8" stdDeviation="3" floodColor="#7d9f9a" floodOpacity=".23"/></filter></defs>
    <rect width="1680" height="930" fill="url(#atlas-sea)"/><rect width="1680" height="930" fill="url(#atlas-water)"/>
    <g fill="none" stroke="#b5d0cf" strokeWidth="1" opacity=".5"><ellipse cx="700" cy="530" rx="660" ry="485"/><ellipse cx="700" cy="530" rx="415" ry="485"/><path d="M40 530H1360 M105 290Q700 230 1295 290 M105 770Q700 830 1295 770"/></g>
    <g fill="none" stroke="#9ab8ae" strokeDasharray="4 9" opacity=".45"><path d="M480 280Q645 70 824 195 M1072 440Q897 574 543 657 M501 812Q744 667 1025 804"/></g>
    {regions.map(region=><g key={region.key} transform={`translate(${framing[region.key].x} ${framing[region.key].y}) translate(${region.label[0]} 0) scale(${framing[region.key].spread} 1) translate(${-region.label[0]} 0)`}><path d={region.path} fill="none" stroke="#f4eed0" strokeWidth="20" opacity=".6"/><path d={region.path} fill={region.color} stroke={region.shore} strokeWidth="2" filter="url(#atlas-coast-shadow)"/><path d={region.path} fill="none" stroke="#f5f3da" strokeWidth="6" opacity=".65" transform={`translate(${region.label[0]*.025} ${region.label[1]*.025}) scale(.975)`}/></g>)}
    {locations.map(({town,x,y,region})=><Settlement key={town.tick} x={x} y={y} color={region.shore}/>)}
    <g fill="#87a8a5" fontFamily="Georgia,serif" fontStyle="italic" fontSize="22" letterSpacing="5" opacity=".7"><text x="560" y="540">共 生 洋</text><text x="76" y="910">OCEAN OF AGENTS</text></g>
    <g transform="translate(80 505)" stroke="#8aa5a1" fill="none"><circle r="24" opacity=".5"/><path d="M0-36V36 M-36 0H36" opacity=".4"/><path d="M0-24L7 0 0 24-7 0Z" fill="#92aaa3" opacity=".7"/><text x="-5" y="-43" fill="#839c96" stroke="none" fontSize="14">N</text></g>
   </svg>
   {regions.map(region=><div key={region.key} className="planet-continent-name" style={{left:`${labelPosition(region)[0]/atlasWidth*100}%`,top:`${labelPosition(region)[1]/atlasHeight*100}%`,color:region.shore}}><h4>{continentNames[region.key]}</h4><span>{groups.get(region.key)!.length} 座已载入小镇</span></div>)}
   {locations.map(({town,x,y})=>{const count=activity.get(town.tick)?.size||0,rows=recent.get(town.tick)||[],latest=rows.find(row=>row.kind!=='post'),speech=rows.find(row=>row.kind==='post');return <div key={town.tick} className="planet-community" style={{left:`${x/atlasWidth*100}%`,top:`${y/atlasHeight*100}%`}}>
    {bubbles&&(latest||speech)&&<div className="planet-island-bubbles">{[latest,speech].filter((item):item is WorldEvent=>!!item).map(latest=><button key={latest.eventKey} className={`planet-activity-bubble ${latest.kind==='post'?'is-speech':'is-transaction'}`} aria-label={`查看 ${town.tick} 的最新${latest.kind==='post'?'发言':'链上动态'}：${eventSentence(latest)}`} onClick={()=>onEvent(latest)}>
      <span key={latest.eventKey} className="map-bubble-content"><span className="map-bubble-meta"><b>{latest.kind==='post'?'发言':'链上动态'}</b><time dateTime={new Date(latest.txTimestamp).toISOString()}>{latest.identitySource==='atlas-registry'?(latest.chainSource==='nodereal'?'身份快照 · ':'历史快照 · '):''}{activityTime(latest.txTimestamp,now)}</time></span>
      <span className="map-bubble-text">{latest.kind==='post'?`${latest.contentSource==='x'?`关联 X @${latest.xHandle}`:latest.name}：${eventContent(latest)||'发布了公开内容'}`:eventSentence(latest)}</span><span className="map-bubble-more">查看详情 ↗</span></span>
     </button>)}</div>}
    <button title={town.name||town.tick} onClick={()=>onTown(town.tick)} aria-label={`进入 ${town.tick} 小镇`}><span className={`planet-town-dot ${count?'has-life':''}`} style={{'--town-hue':stableHash(town.tick)%3} as React.CSSProperties}/><strong>{town.tick}</strong><small>{count?`${count} 位参与者`:coveredTokens.includes(town.token?.toLowerCase()||'')?'快照可用':'活动待载入'}</small></button>
   </div>;})}
  </div></div>
  <footer className="planet-legend"><span><i className="legend-live"/> 已载入活动</span><span><i/> 社区小镇 · 点击进入</span><small>滚轮缩放 · 拖动探索 · 双击恢复全景</small></footer>
 </section>;
}
