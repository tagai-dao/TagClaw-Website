import {translateUI, useLocale, LanguageControls} from '../i18n/react';
import React,{useEffect,useState,useRef} from 'react';
import {Link} from 'react-router-dom';
import {loadManor,type Manor} from '../world/aipro-estate';
import {route,type Point} from '../world/island-path';
import {estateWalkable} from '../world/estate-path';
import {units} from '../world/aipro-economy';
import './aipro-estate.css';
const plots=[{name:'主屋',x:46,y:28},{name:'质押农田',x:26,y:59},{name:'居民农田',x:49,y:65},{name:'金矿',x:84,y:62},{name:'交易看板',x:81,y:28}];
export default function AiproEstate({id}:{id:number}){
  useLocale();
 const [data,setData]=useState<Manor|null>(null),[error,setError]=useState(''),[revision,reload]=useState(0),[panel,open]=useState(''),[actor,move]=useState({x:40,y:45});
 useEffect(()=>{let active=true;const c=new AbortController();setData(previous=>previous?.id===id?previous:null);setError('');loadManor(id,c.signal).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError('庄园数据暂时无法读取，请重试。');});return()=>{active=false;c.abort();};},[id,revision]);
 useEffect(()=>{const t=setInterval(()=>{if(!document.hidden)reload(v=>v+1);},60000);return()=>clearInterval(t);},[]);
 const ready=data?.status==='ready';const stake=ready&&data.info!.indexMiningWeight>0n;const mining=ready&&data.lp?.some(p=>p.amount!=null&&p.amount>0n);
 const [destination,setDestination]=useState<Point|null>(null);
 const walking=useRef<Point[]>([]),current=useRef(actor);
 useEffect(()=>{const timer=setInterval(()=>{const next=walking.current.shift();if(next){current.current=next;move(next);}else setDestination(null);},65);return()=>clearInterval(timer);},[]);
 function stopWalking(){walking.current=[];setDestination(null);}
 function go(x:number,y:number,keyboard=false){
   const to={x:Math.round(x),y:Math.round(y)};if(!estateWalkable(to))return;
   if(keyboard){stopWalking();current.current=to;move(to);return;}
   const next=route(current.current,to,estateWalkable);if(!next.length){if(current.current.x===to.x&&current.current.y===to.y)stopWalking();return;}
   walking.current=next;setDestination(next[next.length-1]);
 }
 const dialog=useRef<HTMLDialogElement>(null);
 const [size,setSize]=useState({w:innerWidth,h:innerHeight}),[zoom,setZoom]=useState(innerWidth<800?2.2:1),[pan,setPan]=useState({x:0,y:0});
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
 useEffect(()=>{const f=()=>setSize({w:innerWidth,h:innerHeight});window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);},[]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close();},[panel]);
 const scale=Math.min(size.w/1536,(size.h-110)/1024)*zoom;
 const visit=(name:string)=>{stopWalking();open(name);};
 return <main className="manor" tabIndex={0} aria-label={translateUI(`庄园 ${id}`)} onKeyDown={e=>{if(panel)return;const d:Record<string,number[]>={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2],a:[-2,0],d:[2,0],w:[0,-2],s:[0,2]};if(d[e.key]){e.preventDefault();go(current.current.x+d[e.key][0],current.current.y+d[e.key][1],true);}}}>
 <div className="estate-viewport" onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setPan({x:drag.current.px+e.clientX-drag.current.x,y:drag.current.py+e.clientY-drag.current.y});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
 <div className="estate-scene" style={{transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${scale})`}}>
 <img className="estate-art" src="/town/aipro-estate-v2.webp" alt={translateUI("像素庄园：主屋、两片篱笆农田、矿洞与交易集市")} fetchPriority="high"/>
 {[{x:26,y:58,active:stake},{x:49,y:62,active:ready}].map((p,i)=><div key={i} className={'estate-crops crop-'+i+' '+(p.active?'planted':'')} style={{left:p.x+'%',top:p.y+'%'}}>{translateUI(p.active&&Array.from({length:12},(_,n)=><i key={n}/>))}</div>)}
 {mining&&<div className="estate-sparks" style={{left:'84%',top:'61%'}}>✦ <span>✦</span> ✦</div>}
 {plots.map((p,i)=><button key={'building-'+p.name} className="estate-building-hit" aria-label={translateUI('查看')+' '+translateUI(p.name)} style={{left:p.x+'%',top:(p.y-2)+'%',width:(i===0?32:17)+'%',height:(i===0?28:17)+'%'}} onClick={()=>visit(p.name)}/>)}
 {plots.map(p=><button className="estate-hotspot" key={p.name} style={{left:p.x+'%',top:(p.y+10)+'%'}} onClick={()=>visit(p.name)}><span className="estate-hotspot-dot"/>{translateUI(p.name)}<small>{translateUI(p.name==='主屋'?(data?.name||'居民资产'):p.name==='质押农田'?(stake?'麦田生长中':'查看质押'):p.name==='居民农田'?'居民收益':p.name==='金矿'?(mining?'矿井运行中':'流动性矿池'):'Agent 交易')}</small></button>)}
 {destination&&<div className="walk-target" data-testid="walk-target" aria-hidden="true" style={{left:destination.x+'%',top:destination.y+'%'}}><i/><span/></div>}
 <div className="estate-visitor" style={{left:actor.x+'%',top:actor.y+'%'}}><i className="player-arrow" aria-hidden="true"/><img src="/town/scout.svg" alt={translateUI("访客")}/><span>{translateUI("访客")}</span></div>
 <button className="estate-walk" aria-label={translateUI("走到庄园道路")} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();go(10+(e.clientX-r.left)/r.width*60,45);}}/>
 </div></div>
 <header><Link to="/town/aipro">{translateUI("← 小镇广场")}</Link><strong>{data?.name||'AIPRO'}{translateUI(" · 庄园 #")}{translateUI(id)}</strong><LanguageControls inline/><button onClick={()=>reload(v=>v+1)}>{translateUI("刷新")}</button></header>
 <nav className="estate-camera" aria-label={translateUI("地图缩放")}><button aria-label={translateUI("缩小")} onClick={()=>setZoom(z=>Math.max(.8,z-.25))}>−</button><button onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>{translateUI("全景")}</button><button aria-label={translateUI("放大")} onClick={()=>setZoom(z=>Math.min(3,z+.25))}>＋</button></nav><nav className="estate-dock" aria-label={translateUI("庄园设施")}>{plots.map((p,i)=><button key={p.name} aria-label={translateUI(p.name)} onClick={()=>visit(p.name)}><span>{translateUI(['⌂','♧','❧','◇','▤'][i])}</span>{translateUI(p.name)}</button>)}</nav><aside>{translateUI(error||(!data?'正在核验庄园…':data.status==='unminted'?'此庄园尚未铸造':data.status==='unverified'?'暂无可展示的 Agent 居民':`居民 ${data.name} · 等级 ${data.info!.level}`))}<small>{translateUI(ready?'点击设施 · 拖动地图 · 方向键移动':'AIPRO RESIDENT ESTATE')}</small>{data&&<small>{translateUI("BSC #")}{translateUI(String(data.block))}</small>}</aside>
 <dialog ref={dialog} className="estate-dialog" aria-label={translateUI(panel||"庄园详情")} onCancel={()=>open('')} onClick={e=>{if(e.target===e.currentTarget)open('');}}><section><button className="close" onClick={()=>open('')}>{translateUI("关闭 ×")}</button><small>{translateUI("ESTATE #")}{translateUI(id)}</small><h2>{translateUI(panel)}</h2>{!ready?<p>{translateUI(error||(!data?'正在读取居民资产与参与记录…':data.status==='unminted'?'此庄园尚未铸造。':'暂无可展示的居民数据。'))}</p>:<>
 {panel==='主屋'&&<><h3>{data.name}</h3><a href={'https://bscscan.com/address/'+data.owner} target="_blank" rel="noreferrer">{translateUI(data.owner)}</a><dl>{[['AIPRO',units(data.balances!.aipro)],['AIPRO NFT',data.balances!.nfts?.toString()??'待读取'],['BNB',units(data.balances!.bnb)],['自身 IPShare · 钱包持有',units(data.balances!.ipshare)]].map(([k,v])=><div key={k}><dt>{translateUI(k)}</dt><dd>{translateUI(v)}</dd></div>)}</dl><p>{translateUI("余额为钱包当前持有，不含已存入矿池的资产。IPShare 此处只统计该 Agent 自身主题的持有份额，不代表其他主题的全部持仓。")}</p></>}
 {panel==='质押农田'&&<><p>{translateUI(stake?'麦田已种植':'尚未参与质押，田地休耕')}</p><p>{translateUI("此 NFT 质押：")}{translateUI(units(data.info!.indexMiningWeight))}{translateUI(" AIPRO")}</p><p>{translateUI("待领取：")}{translateUI(units(data.info!.pendingIndexRewards))}{translateUI(" CyberCab")}</p></>}
 {panel==='居民农田'&&<><p>{translateUI("NFT #")}{translateUI(id)}{translateUI(" · 居民权重 ")}{translateUI(String(data.info!.miningWeight))}</p><p>{translateUI("持有者合计待领取：")}{translateUI(units(data.balances!.pending))}{translateUI(" AIPRO")}</p><small>{translateUI("该金额按地址汇总，多座庄园不能重复相加。")}</small></>}
 {panel==='金矿'&&data.lp?.map(p=><article key={p.pool}><h3>{translateUI(p.label)}</h3><p>{translateUI(p.amount===null?'仓位读取失败':p.amount===0n?'尚未参与':'已有流动性挖矿仓位')}</p><small>{translateUI("质押 LP：")}{translateUI(p.decimals===null?'待读取':units(p.amount,p.decimals))}</small></article>)}
 {panel==='交易看板'&&<><p>{translateUI("TagAI 最新一页 AIPRO 交易中属于此 Agent 的记录，不代表全部历史。")}</p>{data.trades===null?<p>{translateUI("记录暂不可用")}</p>:!data.trades!.length?<p>{translateUI("本批暂无此 Agent 交易。")}</p>:data.trades!.map((r,i)=><article key={r.transHash+':'+i}><p>{translateUI(Number(r.isBuy)===1?'买入':'卖出')} {translateUI(r.amount)}{translateUI(" AIPRO")}</p><a href={'https://bscscan.com/tx/'+r.transHash} target="_blank" rel="noreferrer">{translateUI("交易凭据 ↗")}</a></article>)}</>}
 {!!data.warnings.length&&<p>{translateUI("部分数据暂不可用：")}{translateUI(data.warnings.map(translateUI).join(', '))}</p>}<small>{translateUI("身份快照：")}{translateUI(data.identityTime)}</small></>}</section></dialog>
 </main>;
}
