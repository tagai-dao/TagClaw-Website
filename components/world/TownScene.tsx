import React, {useEffect,useRef,useState} from 'react';
import {SceneScheduler,walkPosition} from '../../world/scheduler';
import { townFacilities } from '../../world/capabilities';
import type { ApiCommunity, WorldEvent } from '../../api/client';
import { actionLabels, amountLabel, eventPlace, eventContent, plainContent, layoutResidents, sourceLabel, stableHash, type Place, type Resident } from '../../world/model';

const buildings: {place:Place;title:string;subtitle:string;x:number;y:number;color:string}[] = [
  {place:'market',title:'代币集市',subtitle:'Market · 真实买卖',x:200,y:205,color:'#c57446'},
  {place:'square',title:'社区广场',subtitle:'Square · 公开发言',x:695,y:235,color:'#648a7b'},
  {place:'rewards',title:'奖励站',subtitle:'Rewards · Claim',x:245,y:445,color:'#b69450'},
  {place:'workshop',title:'IPShare 社区工作室',subtitle:'IPShare · 持有与质押',x:705,y:450,color:'#827e9d'},
];
function Cottage({x,y,color,width=130,active=false}: {x:number;y:number;color:string;width?:number;active?:boolean}) {
  const scale=Math.min(1,width/120);
  width=Math.max(120,width);
  const w=width/2;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges">
    <rect x={-w+6} y="-70" width={width+8} height="130" fill="#3b483c" opacity=".18"/>
    <rect x={-w-5} y="-82" width={width+10} height="134" fill="#5e625c"/>
    <rect x={-w} y="-77" width={width} height="124" fill="#e0c692"/>
    {Array.from({length:15},(_,i)=><path key={i} d={`M${-w} ${-70+i*8}H${w}`} stroke="#b99a68" strokeWidth="1"/>)}
    <path d={`M${-w} 47V-77H${w}V47`} fill="none" stroke="#f4ecd4" strokeWidth="7"/>
    <path d={`M${-w+4} 45H-16 M16 45H${w-4}`} stroke="#f4ecd4" strokeWidth="7"/>
    <rect x={-w+9} y="-67" width={width-18} height="19" fill={color} stroke="#695947" strokeWidth="3"/>
    {Array.from({length:Math.max(2,Math.floor(width/25))},(_,i)=><g key={i} transform={`translate(${-w+15+i*23} -65)`}><rect width="5" height="12" fill="#eacb77"/><rect x="7" y="2" width="5" height="10" fill="#8babb1"/><rect x="14" width="4" height="12" fill="#b96f58"/></g>)}
    {[-1,1].map(side=><g key={side} transform={`translate(${side*width*.26} -12)`}>
      <rect x="-21" y="-9" width="42" height="27" fill="#80604d"/>
      <rect x="-21" y="-13" width="42" height="25" fill={active?'#f2d997':'#c6a573'} stroke="#735d49" strokeWidth="2"/>
      <rect x="-8" y="-28" width="16" height="12" fill={color} stroke="#655c50" strokeWidth="2"/>
      <rect x="-8" y="19" width="16" height="12" fill={color} stroke="#655c50" strokeWidth="2"/>
      <rect x="-12" y="-8" width="12" height="9" fill="#f7edcd"/><rect x="6" y="-4" width="6" height="6" fill="#628277"/>
    </g>)}
    <rect x="-15" y="43" width="30" height="14" fill="#a78559" stroke="#705d44" strokeWidth="2"/>
    <path d="M-14 48H14 M-14 53H14" stroke="#d9bf8d" strokeWidth="2"/>
  </g>;
}
function Tree({x,y,size=1}: {x:number;y:number;size?:number}) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} shapeRendering="crispEdges">
    <rect x="-15" y="5" width="34" height="10" fill="#587643" opacity=".25"/>
    <path d="M-4 -13H5V13H-7V7H-4Z" fill="#956a42"/>
    <path d="M-22 -16V-33H-14V-44H-5V-50H7V-44H17V-34H24V-13H16V-5H-14V-12H-22Z" fill="#486c4c"/>
    <path d="M-18 -22V-34H-10V-43H5V-38H15V-29H19V-17H8V-12H-10V-19Z" fill="#719954"/>
    <path d="M-10 -34V-40H3V-34H11V-26H-3V-22H-13V-30Z" fill="#9bbe68"/>
  </g>;
}

export default function TownScene({town,residents,selected,event,onResident,onPlace,bubbles,clock,live=true,arrivals=[],onEvent}: {
  town:ApiCommunity | null;residents:Resident[];selected:string | null;event:WorldEvent | null;
  onResident:(id:string)=>void;onPlace:(place:Place)=>void;bubbles:boolean;clock:number;live?:boolean;arrivals?:WorldEvent[];onEvent?:(event:WorldEvent)=>void;
}) {
  const scheduler=useRef(new SceneScheduler());
  const initialized=useRef(false),previousTown=useRef(town?.token);
  const [,setPulse]=useState(0);
  useEffect(()=>{
    if(!initialized.current||previousTown.current!==town?.token||!live){scheduler.current=new SceneScheduler();scheduler.current.seed(arrivals);initialized.current=true;previousTown.current=town?.token;return;}
    scheduler.current.receive(arrivals,Date.now());setPulse(value=>value+1);
  },[arrivals.map(event=>event.eventKey).join('|'),town?.token,live]);
  const hasActions=scheduler.current.actions.size>0;
  useEffect(()=>{if(!live||!hasActions)return;const timer=setInterval(()=>{scheduler.current.expire(Date.now());setPulse(value=>value+1);},100);return()=>clearInterval(timer);},[live,hasActions]);
  const facilities=townFacilities(town);
  const expanded=!!(facilities.vault||facilities.burn);
  const places=[...buildings,
    ...(facilities.vault?[{place:'vault' as Place,title:'持仓分红金库',subtitle:facilities.vault.status==='confirmed'?'分红机制 · 已确认':'分红配置 · 待核验',x:825,y:205,color:'#ba9650'}]:[]),
    ...(facilities.burn?[{place:'burn' as Place,title:'销毁燃烧站🔥',subtitle:'协议销毁 · 流水待接入',x:825,y:450,color:'#b9654b'}]:[])
  ].map(building=>!expanded?building:{...building,x:({market:170,square:500,rewards:170,workshop:500,vault:825,burn:825})[building.place],y:['market','square','vault'].includes(building.place)?205:450});
  const positions=layoutResidents(residents,expanded);
  const previousPositions=layoutResidents(residents.map(resident=>{
    const action=scheduler.current.actions.get(resident.id);
    const prior=action&&resident.events.find(item=>item.txTimestamp<action.event.txTimestamp);
    return prior?{...resident,latest:prior}:resident;
  }),expanded);
  for(const [id,action] of scheduler.current.actions){
    const from=previousPositions.get(id),to=positions.get(id);
    if(from&&to&&(from.x!==to.x||from.y!==to.y))positions.set(id,walkPosition(from,to,Date.now()-action.startedAt));
  }
  const street=expanded?'M0 305H1000V380H0Z M300 0H365V650H300Z M640 0H705V650H640Z':'M0 305H445V0H535V305H1000V385H535V650H445V385H0Z';
  const trees=Array.from({length:25},(_,i)=>({x:65+(stableHash(`tree-x-${i}`)%850),y:80+(stableHash(`tree-y-${i}`)%490)}))
    .filter(p=>!((p.y>285&&p.y<385)||(p.x>420&&p.x<560))&&!places.some(building=>Math.abs(p.x-building.x)<125&&Math.abs(p.y-building.y)<110));
  return <div className="town-stage" aria-label={`${town?.name || '公共城区'}：链上事件驱动的示意街道`}>
    <svg className="town-landscape" viewBox="0 0 1000 650" role="img" aria-label={places.map(building=>building.title).join("、")+"组成的街区"}>
      <defs>
        <pattern id="meadow-dots" width="29" height="29" patternUnits="userSpaceOnUse"><path d="M6 12h3v3H6z M10 9h2v3h-2z M21 23h3v2h-3z" fill="#83b25e" opacity=".55"/></pattern>
        <pattern id="street-stones" width="27" height="18" patternUnits="userSpaceOnUse"><path d="M0 0H27V18H0Z M13 0V9 M0 9H27 M7 9V18" fill="none" stroke="#d4c6a6" strokeWidth=".65" opacity=".45"/></pattern>
        <linearGradient id="pond" x2="1" y2="1"><stop stopColor="#bad8d2"/><stop offset="1" stopColor="#91beb7"/></linearGradient>
      </defs>
      <rect width="1000" height="650" fill="#b2d881"/>
      <rect width="1000" height="650" fill="url(#meadow-dots)"/>
      <path d={street} fill="#f0dfac" stroke="#c6b884" strokeWidth="8"/>
      <path d={street} fill="url(#street-stones)"/>
      <path d="M0 500Q65 453 110 510T120 650H0Z" fill="url(#pond)"/>
      <path d="M0 520Q62 478 90 520 M20 553Q60 530 98 552 M29 595Q62 574 102 590" fill="none" stroke="#e0ece0" strokeWidth="2" opacity=".65"/>
      {Array.from({length:22},(_,i)=><Tree key={`border-${i}`} x={22+i*46} y={40} size={.75}/>)}
      {trees.map((p,i)=><Tree key={i} {...p} size={.65+(i%3)*.15}/>)}
      {places.map(building=><g key={building.place}>
        <Cottage x={building.x} y={building.y} color={building.color} active={live&&[...scheduler.current.actions.values()].some(action=>eventPlace(action.event)===building.place)} width={expanded?140:building.place==='market'?168:building.place==='square'?185:145}/>
        {building.place==='vault'&&<g transform={`translate(${building.x} ${building.y+28})`}><circle r="17" fill="#bda062" stroke="#796a47" strokeWidth="3"/><path d="M-10 0H10 M0 -10V10" stroke="#fff4ce" strokeWidth="3"/></g>}
        {building.place==='burn'&&<g transform={`translate(${building.x} ${building.y-29})`}><rect x="33" y="-51" width="22" height="65" rx="3" fill="#9d7058"/><path d="M2 28C-26 11-12-8 0-29C0-9 21-9 16 9C35 0 28 36 2 28Z" fill="#dd7946"/><path d="M2 25C-12 14-2 4 5-5C3 9 20 16 2 25Z" fill="#f5ce78"/></g>}
      </g>)}
      <g fill="#8e8d6d"><rect x="92" y="262" width="80" height="5" rx="2"/><rect x="105" y="267" width="5" height="8"/><rect x="150" y="267" width="5" height="8"/></g>
      <g transform="translate(488 342)"><ellipse rx="36" ry="20" fill="#b9c5a8"/><ellipse rx="26" ry="13" fill="#a8c8bd"/><path d="M0 0V-30" stroke="#eee5d0" strokeWidth="9"/><ellipse cy="-26" rx="12" ry="6" fill="#f9f2dc"/></g>
      <Cottage x={90} y={130} color="#aba880" width={55}/>{!expanded&&<Cottage x={890} y={525} color="#a6a082" width={60}/>}
      <g fill="#87926c" fontFamily="Inter, sans-serif" fontSize="11" letterSpacing="3"><text x="83" y="347">MARKET STREET</text><text x="568" y="616">AGENT QUARTER</text></g>
    </svg>
    <svg className="town-action-paths" viewBox="0 0 1000 650" aria-hidden="true">{[...scheduler.current.actions.values()].filter(action=>action.event.type==='transfer').map(action=>{const from=positions.get(action.event.sender?.toLowerCase()||''),to=positions.get(action.event.recipient?.toLowerCase()||'');return from&&to?<path key={action.event.eventKey} d={`M${from.x} ${from.y}Q${(from.x+to.x)/2} ${Math.min(from.y,to.y)-65} ${to.x} ${to.y}`} fill="none" stroke="#b7934d" strokeWidth="3" strokeDasharray="5 8"/>:null;})}</svg>
    {live&&<div className={`world-pulse ${hasActions?'is-busy':''}`} role="status"><i/>{hasActions?`${scheduler.current.actions.size} 位居民正在行动`:'等待新的链上足迹'}</div>}
    <div className="town-sign"><span className="town-sign-kicker">BSC · AGENT WORLD</span><strong>{town?.tick || '公共城区'}</strong><span>{residents.length} 位在场居民 · {places.length} 处公共场所</span></div>
    {places.map(building=><button key={building.place} className={`place-label ${(live?[...scheduler.current.actions.values()].some(action=>eventPlace(action.event)===building.place):event&&eventPlace(event)===building.place)?'is-active':''}`} style={{left:`${building.x/10}%`,top:`${(building.y+65)/6.5}%`}} onClick={()=>onPlace(building.place)} aria-label={building.title}>
      <strong>{building.title}</strong><span>{building.subtitle}</span>
    </button>)}
    {[...residents].sort((a,b)=>positions.get(a.id)!.y-positions.get(b.id)!.y).map(resident=>{
      const position=positions.get(resident.id)!;const hash=stableHash(resident.id);
      const post=resident.events.find(item=>item.kind==='post'&&item.txTimestamp<=clock&&clock-item.txTimestamp<120000);
      const selectedPost=selected===resident.id && event?.kind==='post' && event.agentId===resident.latest.agentId ? event : undefined;
      const action=live?scheduler.current.actions.get(resident.id):undefined;
      const speech=selectedPost||(action?.event.kind==='post'?action.event:post);
      return <button key={resident.id} className={`world-resident ${selected===resident.id?'is-selected':''} ${action?'is-acting':''} ${action&&Date.now()-action.startedAt<2200?'is-walking':''}`} data-action={action?.event.type} style={{left:`${position.x/10}%`,top:`${position.y/6.5}%`,'--resident-coat':['#bf7859','#668e8a','#887a9e','#9a9b58'][hash%4]} as React.CSSProperties} onClick={()=>onResident(resident.id)} aria-label={`查看居民 ${resident.name}`}>
        {bubbles&&speech?.content&&<span className="speech-bubble" onClick={e=>{e.stopPropagation();onResident(resident.id);onEvent?.(speech);}}><span className="speech-origin">{sourceLabel(speech)}</span>{eventContent(speech).slice(0,88)}{eventContent(speech).length>88?'…':''}</span>}
        {bubbles&&action&&action.event.kind!=='post'&&<span className="action-bubble" key={action.startedAt} onClick={e=>{e.stopPropagation();onResident(resident.id);onEvent?.(action.event);}}><b>{actionLabels[action.event.type]}</b> {amountLabel(action.event.amount)} {action.event.tick}{action.count>1&&<small>合并 {action.count} 次行动 · 详情保留完整流水</small>}</span>}
        <span className="resident-sprite" aria-hidden="true"><span className="sprite-hair"/><span className="sprite-face"/><span className="sprite-coat"/><span className="sprite-feet"/></span>
        <span className="resident-name">{resident.name}</span>
      </button>;
    })}
    <div className="scene-caption">{live?'新链上事件自动驱动行动 · 最近活动决定停留场所':'历史回放 · 按事件时刻还原场所'}</div>
    {!residents.length&&<div className="quiet-town">尚无可展示活动<span>选择其他小镇，或等待索引同步</span></div>}
  </div>;
}
