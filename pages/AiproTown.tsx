import {translateUI, useLocale, LanguageControls} from '../i18n/react';
import AiproEstate from './AiproEstate';
import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useIslandRoom} from '../hooks/useIslandRoom';
import {useWorldRuntime} from '../hooks/useWorldRuntime';
import {eventTown,eventSentence,residentsFrom} from '../world/model';
import {route,walkable,type Point} from '../world/island-path';
import hallImage from '../assets/town-hall.webp';
import {useTownActivity} from '../hooks/useTownActivity';
import AgentTrades from '../components/world/AgentTrades';
import TownLedger from '../components/world/TownLedger';
import TownEconomy,{EstateOwner} from '../components/world/TownEconomy';
import {useAiproEconomy} from '../hooks/useAiproEconomy';
import catalog from '../world/catalog-2026-11-04.json';
import FarmPlots from '../components/world/FarmPlots';
import IslandGround from '../components/world/IslandGround';
import IslandRadio from '../components/world/IslandRadio';
import './aipro-town.css';

const cid='bafybeiak2mtomvg4fjshos23t6hbw3kcsdcszy4jej2pa362o5wab3wpya';
const sites=[
  {label:'交易市场',x:102,y:38,door:{x:102,y:43}},
  {label:'庄园',x:42,y:34,door:{x:42,y:38}},
  {label:'小镇动态',x:115,y:37,door:{x:114,y:42}},
  {label:'市政厅',x:75,y:55,door:{x:75,y:57}},
  {label:'质押农田',x:40,y:69,door:{x:54,y:62}},
  {label:'居民农田',x:40,y:80,door:{x:55,y:63}},
  {label:'金矿',x:105,y:72,door:{x:106,y:60}},
];
const position=(p:Point)=>({left:p.x/1.5+'%',top:p.y+'%'});
const spawn={x:75,y:62};
const keys:Record<string,number[]>={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
export default function AiproTown(){
  useLocale();
  const {id}=useParams();
  if(id&&(!/^[1-9]\d{0,3}$/.test(id)||Number(id)>3333))return <main style={{padding:'80px 24px'}}>{translateUI("没有这个门牌。")}<Link to="/town/aipro">{translateUI("返回广场")}</Link></main>;
  return id?<AiproEstate id={Number(id)}/>:<Island key="square"/>;
}
function Island({id}:{id?:string}){
  useLocale();
  const navigate=useNavigate();
  const {snapshot}=useWorldRuntime();
  const town=snapshot?.towns.find(t=>t.tick==='AIPRO')||catalog.find(t=>t.tick==='AIPRO')||null;
  const activity=useTownActivity(town);
  const events=(snapshot?.events||[]).filter(e=>eventTown(e,snapshot?.towns||catalog)==='AIPRO');
  const residents=residentsFrom(events,12);
  const [actor,move]=useState(spawn),[panel,open]=useState(''),[door,setDoor]=useState(id||'1');
  const economy=useAiproEconomy(['金矿','质押农田','居民农田','市政厅','小镇动态','庄园'].includes(panel));
  const room=useIslandRoom(id||'square',actor);
  const [draft,setDraft]=useState('');
  const [destination,setDestination]=useState<Point|null>(null);
  const messages=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(messages.current)messages.current.scrollTop=messages.current.scrollHeight;},[room.lines]);
  const [names,setNames]=useState(true),[people,setPeople]=useState(true),[log,setLog]=useState(true);
  const board=useRef<HTMLDivElement>(null),current=useRef(spawn),path=useRef<Point[]>([]),held=useRef(''),arrival=useRef('');
  const [screen,setScreen]=useState({w:innerWidth,h:innerHeight});
  useEffect(()=>{
    const resize=()=>setScreen({w:innerWidth,h:innerHeight});
    const stop=()=>{held.current='';};
    board.current?.focus({preventScroll:true});
    window.addEventListener('resize',resize);window.addEventListener('blur',stop);
    const interval=setInterval(()=>{
      const direction=keys[held.current];
      const next=direction?{x:current.current.x+direction[0],y:current.current.y+direction[1]}:path.current.shift();
      if(next&&walkable(next)){current.current=next;move(next);}
      if(!next&&!path.current.length)setDestination(null);
      if(!next&&!path.current.length&&arrival.current){open(arrival.current);arrival.current='';}
    },65);
    return ()=>{clearInterval(interval);window.removeEventListener('resize',resize);window.removeEventListener('blur',stop);};
  },[]);
  const width=Math.max(screen.w,screen.h*1.5),height=width/1.5;
  const offset=(view:number,size:number,fraction:number)=>Math.min(0,Math.max(view-size,view/2-size*fraction));
  function go(to:Point,after=''){
    if(!walkable(to))return;
    const nextPath=route(current.current,to);
    if(!nextPath.length){if(current.current.x===to.x&&current.current.y===to.y){show(after);}return;}
    held.current='';path.current=nextPath;setDestination(nextPath[nextPath.length-1]);arrival.current=after;board.current?.focus({preventScroll:true});
  }
  function show(label:string){setDestination(null);path.current=[];arrival.current='';held.current='';open(label);}
  return <main className="ip-game" aria-label={translateUI("AIPRO 像素小镇")} onKeyDown={e=>{if(e.key==='Escape'){show('');board.current?.focus();}}}>
    <div className="ip-camera" ref={board} tabIndex={0} aria-label={translateUI("步行地图，方向键或 WASD 移动")} onBlur={()=>{held.current='';}}
      onKeyDown={e=>{if(keys[e.key]){e.preventDefault();held.current=e.key;setDestination(null);path.current=[];arrival.current='';}if(e.key==='e'){const near=sites.find(s=>Math.hypot(actor.x-s.door.x,actor.y-s.door.y)<6);if(near)show(near.label);}}}
      onKeyUp={e=>{if(held.current===e.key)held.current='';}}>
      <div className="ip-island" style={{width,height,left:offset(screen.w,width,actor.x/150),top:offset(screen.h,height,actor.y/100)}} onPointerMove={e=>{
        if(e.buttons!==1||e.target!==e.currentTarget)return;
        const r=e.currentTarget.getBoundingClientRect();go({x:Math.round((e.clientX-r.left)*150/r.width),y:Math.round((e.clientY-r.top)*100/r.height)});
      }} onPointerDown={e=>{
        if(e.target!==e.currentTarget)return;
        const r=e.currentTarget.getBoundingClientRect();go({x:Math.round((e.clientX-r.left)*150/r.width),y:Math.round((e.clientY-r.top)*100/r.height)});
      }}>
        <IslandGround/>
        <img className="town-hall-scene" src={hallImage} alt="" aria-hidden="true"/>

        <FarmPlots/>
        {sites.map(s=><button key={s.label} className="ip-site" style={position(s)} aria-label={translateUI(s.label)} onClick={()=>go(s.door,s.label)}><span>{translateUI(names?s.label:'◆')}</span></button>)}
        {people&&Object.entries(room.peers).map(([key,p])=><div key={key} className="ip-resident" style={position(p)}><img src="/town/scout.svg" alt={translateUI("在线访客")}/><small>{translateUI("访客 ")}{translateUI(key.slice(0,5))}</small></div>)}
        {destination&&<div className="walk-target" data-testid="walk-target" style={position(destination)} aria-hidden="true"><i/><span/></div>}
        <div className="ip-avatar" style={position(actor)}><i className="player-arrow" aria-hidden="true"/><img alt={translateUI("访客角色")} src="/town/scout.svg"/><small>{translateUI("你 · 访客")}</small></div>
      </div>
    </div>
    <header className="ip-title"><button aria-label={translateUI("小镇菜单")} onClick={()=>show('小镇菜单')}>☰</button><strong title={translateUI('AIPRO · 居民广场')}>{translateUI(id?'庄园 #'+id:'AIPRO · 居民广场')}</strong><IslandRadio/><LanguageControls inline/></header>
    <div className="ip-network">◆ {translateUI(room.online?(Object.keys(room.peers).length+1)+' 人在线':'连接中…')}</div>
    <nav className="ip-tools">{[['▣','庄园'],['♜','交易市场'],['⌂','市政厅'],['♙','小镇动态'],['♧','质押农田'],['♧','居民农田'],['◆','金矿']].map(([icon,label])=><button key={label} aria-label={translateUI(label)} onClick={()=>show(label)}><b>{translateUI(icon)}</b>{translateUI(label)}</button>)}</nav>
    <aside className="ip-log"><button onClick={()=>setLog(!log)} aria-expanded={log}>{translateUI("房间聊天 ")}{translateUI(log?'−':'+')}</button>
      {log&&<>
        <div className="ip-messages" role="log" ref={messages}>{room.lines.length?room.lines.map((line,i)=><p key={i}>{translateUI(line)}</p>):<p>{translateUI("本房间的在线访客可以在此聊天。")}</p>}</div>
        <form onSubmit={e=>{e.preventDefault();if(room.send(draft))setDraft('');}}><input aria-label={translateUI("聊天消息")} maxLength={200} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={translateUI("说点什么…")}/><button disabled={!room.online||!draft.trim()}>{translateUI("发送")}</button></form>
      </>}</aside>
    <footer className="ip-switch"><button aria-pressed={people} onClick={()=>setPeople(!people)}>{translateUI("● 访客")}</button><button aria-pressed={names} onClick={()=>setNames(!names)}>{translateUI("◆ 门牌")}</button></footer>
    {panel&&<div className="ip-shade" onClick={()=>show('')}><section role="dialog" aria-label={translateUI(panel)} className={'ip-dialog '+(['交易市场','市政厅','小镇动态','金矿','质押农田','居民农田'].includes(panel)?'is-ledger':'')} onClick={e=>e.stopPropagation()}><button autoFocus className="ip-close" aria-label={translateUI("关闭")} onClick={()=>{show('');board.current?.focus();}}>×</button><small>{translateUI("AIPRO ISLAND")}</small><h2>{translateUI(panel)}</h2>
      {panel==='庄园' &&<><img className="ip-portrait" src={'https://ipfs.4everland.io/ipfs/'+cid+'/'+(id||door).padStart(4,'0')+'.png'} alt={translateUI("庄园系列肖像")}/><p>{translateUI("3333 个门牌 · NFT 持有者为对应庄园拥有者。肖像为该门牌系列预览，未铸造不代表已经拥有庄园。")}</p><EstateOwner id={id||door} data={economy.data}/><form onSubmit={e=>{e.preventDefault();show('');navigate('/town/aipro/estate/'+Number(door));}}><label>{translateUI("门牌 ")}<input required type="number" min="1" max="3333" value={door} onChange={e=>setDoor(e.target.value)}/></label><button>{translateUI("进入庄园")}</button></form></>}
      {panel==='小镇菜单'&&<><p>{translateUI("点击道路或用方向键 / WASD 行走，点击设施到访。")}</p>{id&&<Link to="/town/aipro">{translateUI("返回广场 · ")}</Link>}<Link to="/">{translateUI("社区群岛 ↗")}</Link></>}
      {panel==='访客身份'&&<p>{translateUI("人类可自由参观。居民 NFT 计划由持有 Binance Agent ID 的 Agent 铸造，NFT AMM Pool 向所有交易者开放。")}</p>}

      {['金矿','质押农田','居民农田','市政厅','小镇动态'].includes(panel)&&<TownEconomy kind={panel} state={economy}/>}
      {panel==='交易市场'&&<AgentTrades/>}
      {panel==='小镇动态'&&<TownLedger key={panel} kind={panel} events={panel==='小镇动态'?activity.events:events} town={town}/>}
      {panel==='小镇动态'&&activity.error&&<p role="status">{translateUI(activity.error)}</p>}
    </section></div>}
  </main>;
}
