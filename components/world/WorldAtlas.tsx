import React,{useMemo,useState} from 'react';
import type {ApiCommunity,WorldEvent} from '../../api/client';
import {launchPlatform,type LaunchPlatform} from '../../world/protocol';
import {eventTown,stableHash} from '../../world/model';

type Continent=LaunchPlatform|'unmapped';
export const continentNames:Record<Continent,string>={gang:'GANG 洲',flap:'Flap 洲',four:'Four 洲',tagai:'TagAI 洲',unmapped:'待归属群岛'};
const geography:{key:Continent;color:string;shore:string;label:[number,number];slots:[number,number][];path:string}[]=[
 {key:'gang',color:'#c7d7a5',shore:'#a7bf87',label:[295,90],slots:[[225,245],[425,305],[385,170],[190,365],[510,400]],path:'M109 160Q73 120 151 100L234 119Q277 57 335 112L419 100Q451 126 460 161L533 186Q569 229 520 264L547 315Q512 360 455 342L413 401Q363 435 322 395L268 422Q239 389 252 355L186 329Q132 343 109 303L133 252Q87 225 109 160Z'},
 {key:'flap',color:'#c4d8bc',shore:'#9cba9d',label:[1040,60],slots:[[830,205],[1025,185],[1215,235],[790,360],[985,345],[1190,385],[1060,500],[1260,490],[870,490]],path:'M738 154L789 114Q840 141 886 112L946 143Q1006 79 1062 119L1147 102L1182 150Q1274 128 1301 182L1288 226L1344 281Q1341 340 1294 350L1310 414Q1260 445 1223 422L1188 494Q1160 550 1101 527L1054 565L999 528Q959 507 978 462L917 434L865 464L812 419L754 434Q711 408 743 354L689 306Q680 257 730 244L708 195Z'},
 {key:'four',color:'#e5d4a1',shore:'#c9b57c',label:[405,505],slots:[[280,635],[465,650],[355,790],[545,790],[230,765],[480,905]],path:'M214 568Q247 523 293 556L359 534L409 572Q472 547 501 594L560 601L581 649L623 696Q652 742 600 770L604 829L552 872Q512 847 477 896L418 918L379 870L320 884L288 832L232 817Q207 788 236 750L197 697Q162 660 199 627Z'},
 {key:'tagai',color:'#d4cbdc',shore:'#b6a7c3',label:[1115,655],slots:[[1110,800],[960,820],[1245,840],[1080,930]],path:'M926 742Q910 690 970 698L1035 714Q1081 675 1130 717L1184 698L1219 746L1286 767Q1340 818 1296 861L1301 914L1232 946L1189 924L1123 967Q1078 974 1050 932L981 940L958 892L904 872Q878 829 923 797Z'},
 {key:'unmapped',color:'#d2d7c4',shore:'#b1bda5',label:[752,800],slots:[[745,905],[815,1000]],path:'M678 883Q690 848 728 858L762 847L794 875L830 888L821 936L785 962L735 948L700 970L667 938Z'}
];
function Settlement({x,y,color}:{x:number;y:number;color:string}){
 return <g transform={`translate(${x} ${y})`}><ellipse cy="18" rx="67" ry="27" fill={color} opacity=".55"/><path d="M-61 22Q0 44 59 19" stroke="#fbf5d5" strokeWidth="3" fill="none" opacity=".6"/>{[-29,0,28].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i===1?-7:0})`}><rect x="-10" y="-8" width="20" height="22" rx="2" fill="#fff3d7"/><path d="M-15-7L0-20 15-7Z" fill={i===1?'#ba8865':'#829a76'}/><rect x="-3" y="3" width="6" height="11" rx="1" fill="#92836a"/></g>)}</g>;
}
export default function WorldAtlas({towns,events,coveredTokens,onTown}:{towns:ApiCommunity[];events:WorldEvent[];coveredTokens:string[];onTown:(tick:string)=>void}){
 const [zoom,setZoom]=useState(1);
 const groups=useMemo(()=>{
  const result=new Map<Continent,ApiCommunity[]>(geography.map(region=>[region.key,[]]));
  for(const town of towns)result.get(launchPlatform(town)||'unmapped')!.push(town);
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
  return {town,region,x:base[0]+extra*24,y:base[1]+extra*70};
 }));
 return <section className="world-atlas planet-atlas" aria-label="社区群岛世界地图">
  <header className="planet-toolbar"><div><span className="eyebrow">THE AGENT ATLAS</span><h3>同一片海，不同的大陆。</h3><p>沿着海岸探索，直接进入每一座社区。</p></div><div className="planet-zoom" aria-label="地图缩放"><button aria-label="缩小地图" disabled={zoom===1} onClick={()=>setZoom(value=>Math.max(1,value-.25))}>−</button><button aria-label="重置地图缩放" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="放大地图" disabled={zoom===2} onClick={()=>setZoom(value=>Math.min(2,value+.25))}>＋</button></div></header>
  <div className="planet-viewport"><div className="planet-map" style={{width:`${zoom*100}%`}}>
   <svg viewBox="0 0 1400 1060" className="planet-geography" aria-hidden="true">
    <defs><radialGradient id="atlas-sea"><stop stopColor="#e0ede6"/><stop offset="1" stopColor="#c7dfe0"/></radialGradient><pattern id="atlas-water" width="90" height="70" patternUnits="userSpaceOnUse"><path d="M8 35q8-5 16 0t16 0" fill="none" stroke="#8bb4b6" strokeWidth="1" opacity=".2"/></pattern><filter id="atlas-coast-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="8" stdDeviation="3" floodColor="#7d9f9a" floodOpacity=".23"/></filter></defs>
    <rect width="1400" height="1060" fill="url(#atlas-sea)"/><rect width="1400" height="1060" fill="url(#atlas-water)"/>
    <g fill="none" stroke="#b5d0cf" strokeWidth="1" opacity=".5"><ellipse cx="700" cy="530" rx="660" ry="485"/><ellipse cx="700" cy="530" rx="415" ry="485"/><path d="M40 530H1360 M105 290Q700 230 1295 290 M105 770Q700 830 1295 770"/></g>
    <g fill="none" stroke="#9ab8ae" strokeDasharray="4 9" opacity=".45"><path d="M480 280Q645 70 824 195 M1072 440Q897 574 543 657 M501 812Q744 667 1025 804"/></g>
    {regions.map(region=><g key={region.key}><path d={region.path} fill="none" stroke="#f4eed0" strokeWidth="20" opacity=".6"/><path d={region.path} fill={region.color} stroke={region.shore} strokeWidth="2" filter="url(#atlas-coast-shadow)"/><path d={region.path} fill="none" stroke="#f5f3da" strokeWidth="6" opacity=".65" transform={`translate(${region.label[0]*.025} ${region.label[1]*.025}) scale(.975)`}/></g>)}
    <g stroke="#a6b5a0" strokeWidth="2" fill="none" opacity=".5"><path d="M313 149Q282 209 340 261T375 355 M1162 148Q1103 221 1140 279T1108 450 M373 585Q403 654 391 694T430 836"/></g>
    <g fill="#91aa82" opacity=".65">{[[155,194],[493,217],[298,340],[890,286],[1260,315],[920,468],[228,705],[511,730],[1003,777],[1230,879]].map(([x,y],i)=><g key={i}><path d={`M${x-8} ${y+10}L${x} ${y-13}L${x+8} ${y+10}Z`}/><path d={`M${x+7} ${y+14}L${x+14} ${y-4}L${x+21} ${y+14}Z`}/></g>)}</g>
    {locations.map(({town,x,y,region})=><Settlement key={town.tick} x={x} y={y} color={region.shore}/>)}
    <g fill="#87a8a5" fontFamily="Georgia,serif" fontStyle="italic" fontSize="22" letterSpacing="5" opacity=".7"><text x="560" y="540">共 生 洋</text><text x="76" y="940">OCEAN OF AGENTS</text></g>
    <g transform="translate(80 505)" stroke="#8aa5a1" fill="none"><circle r="24" opacity=".5"/><path d="M0-36V36 M-36 0H36" opacity=".4"/><path d="M0-24L7 0 0 24-7 0Z" fill="#92aaa3" opacity=".7"/><text x="-5" y="-43" fill="#839c96" stroke="none" fontSize="14">N</text></g>
   </svg>
   {regions.map(region=><div key={region.key} className="planet-continent-name" style={{left:`${region.label[0]/14}%`,top:`${region.label[1]/10.6}%`,color:region.shore}}><h4>{continentNames[region.key]}</h4><span>{groups.get(region.key)!.length} 座已载入小镇</span></div>)}
   {locations.map(({town,x,y})=>{const count=activity.get(town.tick)?.size||0;return <div key={town.tick} className="planet-community" style={{left:`${x/14}%`,top:`${y/10.6}%`}}>
    <div className="planet-event-airspace" aria-hidden="true"/>
    <button title={town.name||town.tick} onClick={()=>onTown(town.tick)} aria-label={`进入 ${town.tick} 小镇`}><span className={`planet-town-dot ${count?'has-life':''}`} style={{'--town-hue':stableHash(town.tick)%3} as React.CSSProperties}/><strong>{town.tick}</strong><small>{count?`${count} 位参与者`:coveredTokens.includes(town.token?.toLowerCase()||'')?'快照可用':'活动待载入'}</small></button>
   </div>;})}
  </div></div>
  <footer className="planet-legend"><span><i className="legend-live"/> 已载入活动</span><span><i/> 社区小镇 · 点击进入</span><small>按发行来源分洲；仅统计已载入目录。可放大地图并滚动探索。</small></footer>
 </section>;
}
