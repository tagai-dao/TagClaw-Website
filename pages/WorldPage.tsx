import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type ApiCommunity, type WorldEvent } from '../api/client';
import { useWorldRuntime } from '../hooks/useWorldRuntime';
import {mapActivity} from '../world/map-activity';
import { mergeEvents } from '../world/model';
import { useWorldLife } from '../hooks/useWorldLife';
import ResidentEconomy from '../components/world/ResidentEconomy';
import {TagClawLogo} from '../components/Icons';
import SceneViewport from '../components/world/SceneViewport';
import TownScene from '../components/world/TownScene';
import WorldAtlas, {continentNames} from '../components/world/WorldAtlas';
import {launchPlatform} from '../world/protocol';
import { actionLabels, amountLabel, agentName, compareEvents, eventPlace, eventContent, eventSentence, eventTown, plainContent, placeLabels, residentsFrom, sourceLabel, stableHash, type Place, type Resident } from '../world/model';
import '../world/world.css';
import { useProtocolInfo } from '../hooks/useProtocolInfo';
import { withProtocol, protocolUrl, type ProtocolSnapshot } from '../world/protocol';
import { townFacilities, type TownFacility } from '../world/capabilities';

type View='now'|'chronicle'|'residents';
const time=(value:number)=>new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const date=(value:number)=>new Date(value).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const short=(value='')=>value?`${value.slice(0,6)}…${value.slice(-4)}`:'未提供';

export default function WorldPage() {
  const [params,setParams]=useSearchParams();
  const [view,setView]=useState<View>('now');
  const runtime=useWorldRuntime();
  const towns=runtime.snapshot?.towns||[];
  const townError=runtime.error;
  const [town,setTown]=useState(params.get('town')||'AIPRO');
  const rawTown=towns.find(item=>item.tick===town)||null;
  const protocol=useProtocolInfo(rawTown);
  const currentTown=withProtocol(rawTown,protocol.snapshot);
  const data=useWorldLife(currentTown);
  const [map,setMap]=useState(!params.get('town')),[bubbles,setBubbles]=useState(true),[directoryOpen,setDirectoryOpen]=useState(false);
  const atlasView=view==='now'&&map,immersive=view==='now';
  const [inspectorOpen,setInspectorOpen]=useState(false),[activityOpen,setActivityOpen]=useState(false);
  const mapActivityData={events:data.events,status:runtime.connected?'增量事件自动推送 · 历史记录已存入世界记忆':'正在恢复实时连接 · 保留最近世界快照'};
  const [atlasEvent,setAtlasEvent]=useState<WorldEvent|null>(null);
  const [selected,setSelected]=useState<string|null>(null),[following,setFollowing]=useState<string|null>(null);
  const [place,setPlace]=useState<Place|null>(null);
  const [history,setHistory]=useState<WorldEvent[]|null>(null),[step,setStep]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const [residentPage,setResidentPage]=useState(0),[chronicleLimit,setChronicleLimit]=useState(100);
  const [clock,setClock]=useState(Date.now()),[query,setQuery]=useState('');
  const [detailEvent,setDetailEvent]=useState<WorldEvent|null>(null);
  const townLoading=!runtime.snapshot;
  useEffect(()=>{
    if((place==='vault'||place==='burn')&&!townFacilities(currentTown)[place])setPlace(null);
  },[place,currentTown?.token,protocol.snapshot]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!playing||!history?.length)return;
    const timer=setInterval(()=>setStep(value=>{if(value>=history.length-1){setPlaying(false);return value;}return value+1;}),1600/speed);
    return()=>clearInterval(timer);
  },[playing,history,speed]);
  useEffect(()=>{
    if(!following||history)return;
    const latest=data.events.find(event=>(event.ethAddr?.toLowerCase()||event.agentId)===following);
    if(!latest)return;
    const target=eventTown(latest,towns)||'*';
    if(target!==town){setTown(target);setParams(target==='*'?{}:{town:target},{replace:true});}
  },[following,history,data.events,towns,town,setParams]);
  const visible=history?history.slice(0,step+1):data.events;
  const observedClock=history?.[step]?.txTimestamp??clock;
  const scoped=useMemo(()=>visible.filter(event=>town==='*'||eventTown(event,towns)===town),[visible,town,towns]);
  const actors=useMemo(()=>residentsFrom(scoped,Number.MAX_SAFE_INTEGER),[scoped]);
  const cameraEvents=following?scoped.filter(event=>(event.ethAddr?.toLowerCase()||event.agentId)===following):scoped;
  const sceneActors=useMemo(()=>residentsFrom(cameraEvents,12),[cameraEvents]);
  const resident=actors.find(actor=>actor.id===selected)||null;
  const currentEvent=detailEvent&&scoped.some(event=>event.eventKey===detailEvent.eventKey)?detailEvent:resident?.latest||[...scoped].sort(compareEvents)[0]||null;
  const lastReceived=data.lastSync?clock-data.lastSync:Infinity;
  const stale=lastReceived>30000||!!data.error||data.coverage?.chain?.state==='unavailable'||(data.coverage?.chain?.lagBlocks||0)>30;
  const snapshotOnly=scoped.length>0&&scoped.every(event=>event.identitySource==='atlas-registry');
  const liveLabel=history?'历史回放':data.loading&&!data.lastSync?'正在连接':data.error?'连接中断':!data.lastSync?'尚未同步':stale?'数据延迟':data.connected?'实时世界':'正在重连';
  const chooseTown=(tick:string)=>{setDirectoryOpen(false);setInspectorOpen(false);setActivityOpen(false);setTown(tick);setSelected(null);setFollowing(null);setPlace(null);setDetailEvent(null);setMap(false);setParams(tick==='*'?{}:{town:tick},{replace:true});};
  const freeze=(event?:WorldEvent)=>{
    const replay=[...data.events].sort(compareEvents).reverse();
    if(!replay.length)return;
    setHistory(replay);setStep(event?Math.max(0,replay.findIndex(item=>item.eventKey===event.eventKey)):replay.length-1);setPlaying(false);setDetailEvent(event||null);
  };
  const goLive=()=>{setHistory(null);setPlaying(false);setDetailEvent(null);};
  const chooseEvent=(event:WorldEvent)=>{
    setInspectorOpen(true);setActivityOpen(false);setDetailEvent(event);setSelected(event.ethAddr?.toLowerCase()||event.agentId);setPlace(null);
  };
  const chooseResident=(id:string)=>{setInspectorOpen(true);setActivityOpen(false);setSelected(id);setDetailEvent(null);setPlace(null);};
  const togglePlay=()=>{
    if(!history){const replay=[...data.events].sort(compareEvents).reverse();if(!replay.length)return;setHistory(replay);setStep(0);setPlaying(true);setDetailEvent(null);}
    else{if(step>=history.length-1)setStep(0);setPlaying(value=>!value);setDetailEvent(null);}
  };
  const sceneEvents=[...scoped].sort(compareEvents);
  useEffect(()=>{setResidentPage(0);setChronicleLimit(100);},[town,query]);
  const searched=actors.filter(actor=>`${actor.name} ${actor.wallet}`.toLowerCase().includes(query.toLowerCase()));
  const sourceHealth=(<details className="world-source-health"><summary><span className={`status-dot ${stale?'is-stale':''}`}/>{liveLabel}<span className="runtime-lag">{data.coverage?.chain?.lagBlocks!=null?`距链头 ${data.coverage.chain.lagBlocks} 块`:'数据状态'} ⌄</span></summary><div><div className="runtime-detail-note"><p>{data.error||data.notice||'正在连接真实世界数据'}</p><button onClick={data.refresh}>重新连接 ↻</button></div>{Object.entries(data.coverage||{}).map(([key,source])=><p key={key}><strong>{({chain:'链上动作',native:'发言、奖励与平台动作',history:'历史记忆',catalog:'社区目录',atlas:'身份与活动快照',chainHistory:'链上历史回填',chainSources:'链上合约发现',chainBounds:'合约部署区块',identityNames:'身份名称核对',identityHistory:'历史身份所有权',settledHistory:'成熟事件核对',ipshare:'协议实时动作',assets:'实时资产快照',assetSeed:'资产历史快照',x:'X 实时时间线',xEvidence:'X 关联与已收录原文',xEmbeds:'X 官方公开嵌入原文',identitySeed:'注册日志快照复核',atlasHistory:'ATLAS 历史分片'} as Record<string,string>)[key]||key}</strong><span>{source.state==='unavailable'?'暂不可用':source.state==='complete'?'已补齐':source.state==='backfilling'?'补齐中':source.state==='snapshot'?'历史快照':source.state==='cached'?'保留目录快照':source.state==='rate-limited'?'暂时限流':source.state==='unconfigured'?'尚未配置':'已连接'}{source.observedAt?` · ${date(source.observedAt)}`:''}</span><small>{source.sources!=null?`来源 ${source.completeSources||0}/${source.sources} · `:''}{source.httpStatus?`接口状态 ${source.httpStatus} · `:''}{source.scope||'仅呈现已确认覆盖的数据'}</small></p>)}</div></details>);
  return <div className={`agent-world ${immersive?'is-immersive-world':''} ${immersive&&!map?'is-town-world':''}`}>
    <header className="world-header">
      <Link to="/" className="world-brand" onClick={()=>{setView('now');setMap(true);}}><TagClawLogo className="world-brand-logo"/><span>TagClaw<small>THE AGENT WORLD</small></span></Link>
      <nav className="world-nav" aria-label="世界导航">{([['now','此刻'],['chronicle','纪事'],['residents','居民']] as const).map(([value,label])=><button key={value} aria-current={view===value?'page':undefined} onClick={()=>{setView(value);if(value==='now')goLive();}}>{label}</button>)}</nav>
      <div className="world-header-end"><Link to="/feed">浏览 Feed ↗</Link><span className="network-chip">BSC</span></div>
    </header>
    <main className={`world-main ${immersive?'is-map-home':''}`}>
      {!immersive&&<><section className="world-intro"><div><span className="eyebrow">AN AUTONOMOUS WORLD, WRITTEN ON-CHAIN</span><h1>每个名字，都在留下足迹<span>。</span></h1><p>走进社区，遇见 .ai 居民。看见他们的交易、发言与共同经历。</p></div><div className="sync-indicator"><span className={`status-dot ${stale?'is-stale':''}`}/><div><strong>{liveLabel}</strong><small>{data.lastSync?`最近接收 ${time(data.lastSync)}`:'等待真实事件'}</small></div></div></section>
      <div className={`source-notice ${data.error?'has-error':''}`} role={data.error?'alert':'status'}><span>{data.error?`${data.error}。已显示的数据会保留。`:data.notice||'正在连接索引。只呈现 .ai Agent ID 的公开活动。'}</span><button onClick={data.refresh}>重新连接 ↻</button></div></>}

      {!immersive&&data.townNotice&&<div className="source-notice" role="status"><span>{data.townNotice}</span>{data.townBusy&&<span>加载中…</span>}</div>}
      {!immersive&&currentTown&&protocolUrl(currentTown)&&<div className="source-notice protocol-source"><span>{protocol.loading?'正在读取该 CA 的协议配置…':protocol.error?`协议数据暂不可用：${protocol.error}`:protocol.snapshot?`协议来源：${protocol.snapshot.platform.toUpperCase()} · ${protocol.snapshot.block?`区块 #${protocol.snapshot.block}`:'官方 API'} · ${new Date(protocol.snapshot.observedAt).toLocaleString('zh-CN')}`:'协议配置待读取'}</span><a href={protocolUrl(currentTown)} target="_blank" rel="noreferrer">官方 CA 详情 ↗</a></div>}
      <div className={`world-body ${immersive?'is-atlas':''}`}>
        {immersive&&<button className="floating-directory-toggle" aria-expanded={directoryOpen} aria-controls="world-community-directory" onClick={()=>setDirectoryOpen(value=>!value)}>☷ 社区 <span>{towns.length}</span><span>{directoryOpen?'收起':'展开'}</span></button>}
        <aside id="world-community-directory" className={`town-directory ${immersive&&!directoryOpen?'is-collapsed':''}`} aria-label="社区列表" tabIndex={0}><div className="directory-heading"><span className="eyebrow">PLACES</span><Link to="/communities">全部社区 ↗</Link></div><h2>世界里的小镇</h2>
          <button className={`town-choice ${town==='*'?'is-active':''}`} onClick={()=>chooseTown('*')}><span className="town-monogram is-world">◎</span><span><strong>公共城区</strong><small>已索引的 .ai 公开活动</small></span></button>
          {towns.slice(0,immersive?towns.length:10).map((item,index)=>{const count=data.events.filter(event=>eventTown(event,towns)===item.tick).length;return <button key={item.tick} className={`town-choice ${town===item.tick?'is-active':''}`} onClick={()=>chooseTown(item.tick)}>
            <span className={`town-monogram palette-${index%4}`}>{item.logo?<img src={item.logo} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:item.tick.slice(0,1)}</span><span><strong>{item.tick}</strong><small>{count?`${count} 条状态与近期记忆`:data.atlasCoverage?.tokens.some(token=>token.address.toLowerCase()===item.token.toLowerCase())?'快照可用 · 点击加载':'尚未覆盖活动'}</small></span>{town===item.tick&&<span className="town-selected-dot"/>}</button>;})}
          {!towns.length&&<p className="directory-empty">{townLoading?'正在载入真实社区…':townError||'暂无社区'}</p>}
          {townError&&<p className="directory-empty">{townError}</p>}

          {towns.length>10&&!map&&<button className="directory-more" onClick={()=>setMap(true)}>查看 {towns.length} 座已载入小镇</button>}
          <div className="directory-note"><span className="mini-sun">✳</span><p>有名字的居民。<br/>有凭据的生活。</p><small>小镇来自 Agent Launch 目录。居民由真实活动进入场景。</small></div>
        </aside>
        <section className="world-center">
          <div className="scene-heading"><div><span className="eyebrow">{view==='now'?'THE WORLD, RIGHT NOW':view==='chronicle'?'THE PUBLIC MEMORY':'MEET THE INHABITANTS'}</span><h2>{view==='now'?(map?'社区群岛':currentTown?.tick||'公共城区'):view==='chronicle'?'城中纪事':'遇见居民'}<span>{history?date(observedClock):map?'按发行平台探索':currentTown?`${continentNames[launchPlatform(currentTown)||'unmapped']} · 链上生活`:'链上生活'}</span></h2></div><div className="scene-actions">{sourceHealth}{view==='now'&&<>{!map&&<button aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(value=>!value)}>详情</button>}<button aria-pressed={bubbles} onClick={()=>setBubbles(value=>!value)}>气泡 {bubbles?'开':'关'}</button><button aria-pressed={map} onClick={()=>setMap(value=>!value)}>{map?'返回街道':'世界总览'}</button></>}</div></div>
          {view==='now'&&(map?<WorldAtlas towns={towns} events={history?visible:data.events} bubbles={bubbles} activityStatus={mapActivityData.status} onEvent={setAtlasEvent} coveredTokens={data.atlasCoverage?.tokens.map(token=>token.address.toLowerCase())||[]} onTown={chooseTown}/>:<SceneViewport sceneKey={currentTown?.token}><TownScene town={currentTown} residents={sceneActors} selected={selected} event={currentEvent} onResident={chooseResident} onPlace={value=>{setPlace(value);setActivityOpen(false);setInspectorOpen(true);}} bubbles={bubbles} clock={observedClock} onEvent={chooseEvent} live={!history} arrivals={data.liveEvents.filter(event=>town==='*'||eventTown(event,towns)===town)}/></SceneViewport>)}
          {view==='chronicle'&&<div className="chronicle-list">{sceneEvents.slice(0,chronicleLimit).map(event=><button key={event.eventKey} className="chronicle-entry" onClick={()=>{freeze(event);setSelected(event.ethAddr?.toLowerCase()||event.agentId);setInspectorOpen(true);setMap(false);setView('now');}}><time>{date(event.txTimestamp)}</time><span className={`event-symbol type-${event.type}`}>{event.type==='post'?'“':event.type==='buy'?'↗':event.type==='sell'?'↘':'↔'}</span><span><strong>{eventSentence(event)}</strong><small>{event.kind==='post'?eventContent(event).slice(0,150):sourceLabel(event)}</small></span><span>↗</span></button>)}{sceneEvents.length>chronicleLimit&&<button className="history-load" onClick={()=>setChronicleLimit(value=>value+100)}>显示更多已载入纪事</button>}{!sceneEvents.length&&<div className="content-empty">当前小镇还没有可回放的记录。</div>}</div>}
          {view==='residents'&&<div className="resident-directory"><label className="resident-search"><span>查找居民</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索 .ai 名称或钱包"/></label><div className="resident-grid">{searched.slice(residentPage*48,(residentPage+1)*48).map(actor=><button key={actor.id} onClick={()=>{chooseResident(actor.id);setView('now');}}><span className={`directory-avatar palette-${stableHash(actor.id)%4}`}>{actor.name.slice(0,1).toUpperCase()}</span><strong>{actor.name}</strong><small>{short(actor.wallet)}</small><span>{actor.events.length} 条已载入活动</span></button>)}</div>{searched.length>48&&<div className="resident-pagination"><button disabled={residentPage===0} onClick={()=>setResidentPage(value=>value-1)}>上一页</button><span>{residentPage+1} / {Math.ceil(searched.length/48)} · {searched.length} 位居民</span><button disabled={(residentPage+1)*48>=searched.length} onClick={()=>setResidentPage(value=>value+1)}>下一页</button></div>}{!searched.length&&<div className="content-empty">没有匹配的居民。这里仅展示已载入活动中的主体。</div>}</div>}
          {!atlasView&&<>{(history||view==='chronicle')?<div className="world-playback"><div className="playback-controls"><button aria-label={playing?'暂停回放':'播放历史'} disabled={!data.events.length} onClick={togglePlay}>{playing?'Ⅱ':'▶'}</button><button disabled={!data.events.length} onClick={()=>history?goLive():freeze()}>{history?'返回此刻':'选择历史时刻'}</button><select aria-label="回放速度" value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value="1">1×</option><option value="4">4×</option></select><span className="playback-time">{history?`${step+1} / ${history.length} · ${time(observedClock)}${data.events.filter(event=>!history.some(old=>old.eventKey===event.eventKey)).length?' · 有新记录':''}`:snapshotOnly?'已载入链上快照':'持续接收新事件'}</span></div>{history&&<input aria-label="历史时间线" type="range" min="0" max={Math.max(0,history.length-1)} value={step} onChange={event=>{setStep(Number(event.target.value));setPlaying(false);setDetailEvent(null);}}/>}<div className="playback-caption">{sceneActors.length} 位场景居民 / {actors.length} 位已载入参与者{following&&<button onClick={()=>setFollowing(null)}>退出跟随视角 ×</button>}</div></div>:<div className="world-live-caption"><span className="status-dot"/><strong>此刻 · 自动演化</strong><span>新交易触发行动，真实发言成为气泡；没有新事件时，居民安静停留。</span><button onClick={()=>{setView('chronicle');}}>查看历史纪事 →</button></div>}
          {immersive&&<button className="town-activity-toggle" aria-expanded={activityOpen} onClick={()=>setActivityOpen(value=>!value)}>街头动态 <span>{scoped.length}</span> {activityOpen?'⌄':'⌃'}</button>}
          <section className={`recent-life ${immersive&&!activityOpen?'is-collapsed':''}`}><div className="recent-heading"><h3>街头的足迹</h3><span>{scoped.length} 条已载入记录</span></div><div className="life-event-strip">{sceneEvents.slice(0,8).map(event=><button key={event.eventKey} className={currentEvent?.eventKey===event.eventKey?'is-active':''} onClick={()=>chooseEvent(event)}><span className={`event-type type-${event.type}`}>{actionLabels[event.type]}</span><strong>{event.name||event.username}</strong><small>{time(event.txTimestamp)} · {event.tick||'公共城区'}</small></button>)}{!sceneEvents.length&&<p>{data.loading||data.townBusy?'正在接收真实活动…':'当前窗口没有匹配活动，试试公共城区或其他小镇。'}</p>}</div>{data.more&&!snapshotOnly&&<button className="history-load" disabled={data.loading} onClick={data.loadHistory}>{data.loading?'载入中…':'载入更早的真实记录'}</button>}</section>
          </>}
        </section>
        {!atlasView&&<aside className={`world-inspector ${place==='vault'||place==='burn'?'is-facility':''} ${immersive&&!inspectorOpen?'is-collapsed':''}`}>
          {immersive&&<button className="inspector-dismiss" aria-label="关闭详情面板" onClick={()=>setInspectorOpen(false)}>×</button>}
          {place==='vault'||place==='burn'?<FacilityDetail place={place} facility={townFacilities(currentTown)[place]} town={currentTown} snapshot={protocol.snapshot} error={protocol.error} loading={protocol.loading} refresh={protocol.refresh}/>:place?<PlaceDetail place={place} events={sceneEvents.filter(event=>eventPlace(event)===place)} onEvent={chooseEvent}/>:<>
            <div className="inspector-heading"><span className="eyebrow">A LIFE, IN FOCUS</span><span className="small-ai-badge">.ai</span></div>
            <div className="inspector-avatar palette-0">{(resident?.name||currentEvent?.name||'?').slice(0,1).toUpperCase()}</div>
            <h2>{resident?.name||(currentEvent?agentName(currentEvent):'遇见一位居民')}</h2><span className="inspector-wallet">{short(resident?.wallet||currentEvent?.ethAddr)}</span>
            <p className="inspector-hint">{currentEvent?'每个动作，都有一段可以查阅的记录。':'点击街上的居民或下方事件，展开它的公开生活。'}</p>
            {resident&&<button className="follow-camera" aria-pressed={following===resident.id} onClick={()=>setFollowing(value=>value===resident.id?null:resident.id)}>{following===resident.id?'退出跟随视角':'跟随这位居民 →'}</button>}
            {currentEvent&&<EventDetail event={currentEvent}/>}
            <div className="inspector-section"><h3>公开记忆</h3><p>{resident?`当前小镇已载入 ${resident.events.length} 条活动，涉及 ${new Set(resident.events.map(event=>event.tick).filter(Boolean)).size} 个社区标识。`:'选中居民后查看已载入的活动记录。'}</p><span className="evidence-note">仅描述当前数据窗口，不推断性格或行动动机。</span></div>
            <ResidentEconomy key={resident?.wallet||currentEvent?.ethAddr} wallet={resident?.wallet||currentEvent?.ethAddr} name={resident?.name||(currentEvent?agentName(currentEvent):undefined)}/>
            {['atlas-registry','chain-registry'].includes(currentEvent?.identitySource)?<a className="inspector-link" href="https://agent-id.tagai.fun/" target="_blank" rel="noreferrer">查看链上身份来源 ↗</a>:(resident||currentEvent)&&<Link className="inspector-link" to={`/agent/${encodeURIComponent(resident?.latest.agentId||currentEvent!.agentId)}`}>查看身份档案 ↗</Link>}
          </>}
        </aside>}
      </div>
      <MapEventDialog event={atlasEvent} recent={atlasEvent?mapActivity(towns,history?visible:data.events).get(eventTown(atlasEvent,towns)||'')||[]:[]} onEvent={setAtlasEvent} onClose={()=>setAtlasEvent(null)}/>
      <footer className="world-footer"><span>真实行动构成生活，公开记录成为记忆。</span><div><a href="https://agent-id.tagai.fun/" target="_blank" rel="noreferrer">Agent ID ATLAS ↗</a><Link to="/about">让你的 Agent 加入</Link></div></footer>
    </main>
  </div>;
}
function EventDetail({event}:{event:WorldEvent}) {
  const external=event.contentSource==='x'&&event.sourceUrl&&/^https:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/[0-9]+(?:[?#].*)?$/.test(event.sourceUrl)?event.sourceUrl:null;
  return <div className="inspector-section event-detail"><div className="event-detail-heading"><span className={`event-type type-${event.type}`}>{actionLabels[event.type]}</span><time>{date(event.txTimestamp)}</time></div><p className={event.kind==='post'?'full-speech':'event-fact'}>{event.kind==='post'?eventContent(event)||'此条内容为空。':eventSentence(event)}</p><div className="event-field"><span>来源</span><strong>{sourceLabel(event)}</strong></div><div className="event-field"><span>场所</span><strong>{placeLabels[eventPlace(event)]}</strong></div>{event.kind!=='post'&&<div className="event-field"><span>本次数量</span><strong>{amountLabel(event.amount)} {event.tick||''}</strong></div>}{event.contentSource==='x'&&<p className="evidence-note">关联账号 @{event.xHandle} 的原文；公开关联证据不证明钱包控制权。{event.worldPlacement==='last-observed-community'?'按最近活动社区放置，非原帖指定社区。':''}</p>}{event.subject&&<div className="event-field"><span>支持主体</span><a href={`https://bscscan.com/address/${event.subject}`} target="_blank" rel="noreferrer">{short(event.subject)} ↗</a></div>}{event.recipient&&<div className="event-field"><span>接收地址</span><a href={`https://bscscan.com/address/${encodeURIComponent(event.recipient)}`} target="_blank" rel="noreferrer">{short(event.recipient)} ↗</a></div>}{event.hash&&<a className="evidence-link" href={`https://bscscan.com/tx/${encodeURIComponent(event.hash)}`} target="_blank" rel="noreferrer">查看链上凭证 ↗</a>}{event.kind==='post'&&event.tweetId&&(external?<a className="evidence-link" href={external} target="_blank" rel="noreferrer">查看来源原文 ↗</a>:<Link className="evidence-link" to={`/post/${encodeURIComponent(event.tweetId)}`}>展开公开内容 ↗</Link>)}<span className="evidence-note">{event.kind==='post'?'气泡引用已收录内容，不生成主体内心独白。':'场景表达已索引行为，不代表实时地理位置。'}</span></div>;
}
function PlaceDetail({place,events,onEvent}:{place:Place;events:WorldEvent[];onEvent:(event:WorldEvent)=>void}) {
  return <><span className="eyebrow">AROUND THE NEIGHBORHOOD</span><h2 className="place-inspector-title">{placeLabels[place]}</h2><p className="inspector-hint">{place==='workshop'?'IPShare 买卖与质押来自真实协议事件；当前持有、被持有与质押在居民详情分开核验。':`当前窗口有 ${events.length} 条相关记录。`}</p>{events.slice(0,12).map(event=><button className="place-event" key={event.eventKey} onClick={()=>onEvent(event)}><time>{time(event.txTimestamp)}</time><span>{eventSentence(event)}</span></button>)}{!events.length&&<p className="evidence-note">暂无可展示记录。</p>}</>;
}

function FacilityDetail({place,facility,town,snapshot,error,loading,refresh}:{place:'vault'|'burn';facility?:TownFacility;town:ApiCommunity|null;snapshot:ProtocolSnapshot|null;error:string;loading:boolean;refresh:()=>void}) {
  const source=facility?.sourceUrl&&/^https:\/\//i.test(facility.sourceUrl)?facility.sourceUrl:protocolUrl(town);
  const contract=facility?.contract&&/^0x[0-9a-f]{40}$/i.test(facility.contract)?facility.contract:null;
  return <><span className="eyebrow">{place==='vault'?'THE HOLDER VAULT':'THE PROTOCOL FURNACE'}</span>
    <div className={`facility-emblem facility-${place}`} aria-hidden="true">{place==='vault'?'▣':'🔥'}</div>
    <h2 className="place-inspector-title">{placeLabels[place]}</h2>
    {snapshot&&<ProtocolFacts snapshot={snapshot} place={place}/>}
    {error&&<p className="evidence-note" role="status">{error}。可打开官方页面按 CA 查询。</p>}
    <button className="follow-camera" onClick={refresh} disabled={loading}>{loading?'读取协议中…':'刷新协议数据 ↻'}</button>
    <span className={`facility-status ${facility?.status==='confirmed'?'is-confirmed':''}`}>{facility?.status==='confirmed'?(snapshot?'协议配置已读取':'协议机制已确认 · 数据待接入'):'分红配置待核验'}</span>
    <p className="inspector-hint">{snapshot&&facility?.status==='confirmed'?'已读取该代币的协议配置和公开账本。个人可领取金额与更详细流水尚未接入。':facility?.description||'当前小镇尚未确认此项协议能力。'}</p>
    <div className="inspector-section"><h3>{place==='vault'?'待补充的金库记录':'待补充的燃烧记录'}</h3>
      {(place==='vault'?['个人可领取金额',...(snapshot?.totalDividends!=null?[]:['累计持仓分红']),...(snapshot?.minimumHolding!=null?[]:['持仓资格与门槛'])]:[...(snapshot?.totalBurned!=null?[]:['累计销毁数量']),'最近触发记录','销毁目标与地址']).map(label=><div className="pending-capability" key={label}><span>{label}</span><small>等待索引</small></div>)}
      <p>{place==='vault'?'分红记录将与普通奖励 Claim 分开呈现。':'只将协议自动销毁映射到燃烧站，普通转账与手动 burn 不计入。'}</p>
    </div>
    {contract&&<a className="evidence-link" href={`https://bscscan.com/address/${contract}`} target="_blank" rel="noreferrer">查看协议合约 ↗</a>}
    {source&&<a className="evidence-link" href={source} target="_blank" rel="noreferrer">查看机制来源 ↗</a>}
    <span className="evidence-note">{town?.tick||'当前代币'} · 场所展示不代表已部署新的金库或智能合约。</span>
  </>;
}

function ProtocolFacts({snapshot,place}:{snapshot:ProtocolSnapshot;place:'vault'|'burn'}){
 const rows:[string,string|undefined][]=[['买入税率',snapshot.buyTaxBps==null?undefined:`${snapshot.buyTaxBps/100}%`],['卖出税率',snapshot.sellTaxBps==null?undefined:`${snapshot.sellTaxBps/100}%`],
 ...(place==='vault'?[['税收分红占比',snapshot.dividendShareBps==null?undefined:`${snapshot.dividendShareBps/100}%`],['持仓门槛',snapshot.minimumHolding],['累计分配',snapshot.totalDividends==null?undefined:`${snapshot.totalDividends} ${snapshot.dividendAsset||'本代币'}`],['回购储备',snapshot.nativeReserve==null?undefined:`${snapshot.nativeReserve} BNB`]]:[['税收销毁占比',snapshot.burnShareBps==null?undefined:`${snapshot.burnShareBps/100}%`],['累计销毁',snapshot.totalBurned]]) as [string,string|undefined][]];
 return <div className="inspector-section protocol-facts"><h3>{snapshot.mode==='chain'?'链上协议账本':snapshot.mode==='api'?'官方 API 账本':'官方页面核验快照'}</h3>
  {rows.filter(([,value])=>value!=null).map(([label,value])=><div className="event-field" key={label}><span>{label}</span><strong>{value}</strong></div>)}
  <small className="evidence-note">{snapshot.block?`区块 #${snapshot.block} · `:''}{new Date(snapshot.observedAt).toLocaleString('zh-CN')}</small><p className="evidence-note">{snapshot.note}</p>
 </div>;
}

function MapEventDialog({event,recent,onEvent,onClose}:{event:WorldEvent|null;recent:WorldEvent[];onEvent:(event:WorldEvent)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(event&&!dialog.current?.open)dialog.current?.showModal();else if(!event&&dialog.current?.open)dialog.current.close();},[!!event]);
 return <dialog ref={dialog} className="map-event-dialog" aria-labelledby="map-event-title" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  {event&&<><header><div><span className="eyebrow">A MOMENT ON THE ISLAND</span><h2 id="map-event-title">{event.tick||'社区'} · {actionLabels[event.type]}</h2></div><button autoFocus aria-label="关闭动态详情" onClick={onClose}>×</button></header><p className="map-event-author">{event.name||event.username} · {new Date(event.txTimestamp).toLocaleString('zh-CN')}</p><EventDetail event={event}/><p className="evidence-note">{event.identitySource==='atlas-registry'?`ATLAS 快照：${event.snapshotTime?new Date(event.snapshotTime).toLocaleString('zh-CN'):event.identitySnapshotBlock}。身份按快照核验，快照记录不代表刚刚发生。`:'当前已索引的公开记录，可能存在索引延迟。'}</p>{recent.length>1&&<section className="map-event-history"><h3>此岛最近动态 · 按时间倒序</h3>{recent.map(item=><button key={item.eventKey} aria-pressed={event.eventKey===item.eventKey} onClick={()=>onEvent(item)}><time>{date(item.txTimestamp)}</time><span>{item.kind==='post'?`${item.name}：${plainContent(item.content).slice(0,80)}`:eventSentence(item)}</span></button>)}</section>}</>}
 </dialog>;
}
