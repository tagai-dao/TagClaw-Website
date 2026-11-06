import {translateUI, getLocale, useLocale, LanguageControls} from '../i18n/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { type ApiCommunity, type WorldEvent } from '../api/client';
import { useWorldRuntime } from '../hooks/useWorldRuntime';
import {mapActivity} from '../world/map-activity';
import { mergeEvents } from '../world/model';
import { useWorldLife } from '../hooks/useWorldLife';
import PostInteractions from '../components/world/PostInteractions';
import ResidentEconomy from '../components/world/ResidentEconomy';
import {TagClawLogo} from '../components/Icons';
import SceneViewport from '../components/world/SceneViewport';
import TownScene from '../components/world/TownScene';
import WorldAtlas, {continentNames} from '../components/world/WorldAtlas';
import {launchPlatform} from '../world/protocol';
import { actionLabels, amountLabel, agentName, compareEvents, eventPlace, eventContent, eventSentence, eventTown, plainContent, placeLabels, residentsFrom, sourceLabel, stableHash, type Place, type Resident } from '../world/model';
import '../world/world.css';
import {useTownCatalog} from '../hooks/useTownCatalog';
import catalogSnapshot from '../world/catalog-2026-11-04.json';
import { useProtocolInfo } from '../hooks/useProtocolInfo';
import { withProtocol, protocolUrl, type ProtocolSnapshot } from '../world/protocol';
import { townFacilities, type TownFacility } from '../world/capabilities';

type View='now'|'chronicle'|'residents';
const time=(value:number)=>new Date(value).toLocaleTimeString(getLocale(),{hour:'2-digit',minute:'2-digit',hour12:false});
const date=(value:number)=>new Date(value).toLocaleString(getLocale(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const short=(value='')=>value?`${value.slice(0,6)}…${value.slice(-4)}`:'未提供';

const viewPaths: Record<View, string> = {now: '/main', chronicle: '/feed', residents: '/ai-agents'};

export default function WorldPage({view = 'now'}: {view?: View}) {
  useLocale();
  const [params,setParams]=useSearchParams();
  const navigate = useNavigate();
  const {search} = useLocation();
  const openView = (next: View) => navigate({pathname: viewPaths[next], search});
  const runtime=useWorldRuntime();
  const catalog=useTownCatalog();
  const towns=catalog.towns??runtime.snapshot?.towns??(view==='now'?catalogSnapshot:[]);
  const townError=catalog.error||runtime.error;
  const [town,setTown]=useState(params.get('town')||'AIPRO');
  const rawTown=towns.find(item=>item.tick===town)||null;
  const protocol=useProtocolInfo(rawTown);
  const currentTown=withProtocol(rawTown,protocol.snapshot);
  const data=useWorldLife(currentTown);
  const [map,setMap]=useState(!params.get('town')),[bubbles,setBubbles]=useState(true),[directoryOpen,setDirectoryOpen]=useState(false);
  const [townListExpanded,setTownListExpanded]=useState(false);
  const atlasView=view==='now'&&map,immersive=view==='now';
  const [inspectorOpen,setInspectorOpen]=useState(false),[activityOpen,setActivityOpen]=useState(false);
  const mapActivityData={events:data.events,status:runtime.connected?'增量事件自动推送 · 历史记录已存入世界记忆':'正在恢复实时连接 · 保留最近世界快照'};
  const [atlasEvent,setAtlasEvent]=useState<WorldEvent|null>(null);
  const [selected,setSelected]=useState<string|null>(null),[following,setFollowing]=useState<string|null>(null);
  const [place,setPlace]=useState<Place|null>(null);
  const [history,setHistory]=useState<WorldEvent[]|null>(null),[step,setStep]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const [feedFilter,setFeedFilter]=useState<'all'|'post'|'trade'>('all');
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
  const searched=actors.filter(actor=>`${actor.name} ${actor.wallet}`.toLowerCase().includes(query.toLowerCase()));
  const pageResidents=searched.slice(residentPage*48,(residentPage+1)*48);
  const resident=view==='residents'?(pageResidents.find(actor=>actor.id===selected)||pageResidents[0]):actors.find(actor=>actor.id===selected);
  const sceneEvents=useMemo(()=>[...scoped].sort(compareEvents),[scoped]);
  const feedEvents=useMemo(()=>sceneEvents.filter(event=>feedFilter==='all'||event.kind===feedFilter||
    (feedFilter==='trade'&&event.kind==='ipshare'&&['buy','sell'].includes(event.protocolAction||''))),[sceneEvents,feedFilter]);
  const feedEvent=feedEvents.find(event=>event.eventKey===detailEvent?.eventKey)||feedEvents[0];
  const currentEvent=view==='residents'?resident?.latest:view==='chronicle'?feedEvent:
    detailEvent&&scoped.some(event=>event.eventKey===detailEvent.eventKey)?detailEvent:resident?.latest||sceneEvents[0];
  const lastReceived=data.lastSync?clock-data.lastSync:Infinity;
  const stale=lastReceived>30000||!!data.error||data.coverage?.chain?.state==='unavailable'||(data.coverage?.chain?.lagBlocks||0)>30;
  const snapshotOnly=scoped.length>0&&scoped.every(event=>event.identitySource==='atlas-registry');
  const liveLabel=history?'历史回放':data.loading&&!data.lastSync?'正在连接':data.error?'连接中断':!data.lastSync?'尚未同步':stale?'数据延迟':data.connected?'实时世界':'正在重连';
  const chooseTown=(tick:string)=>{if(view==='now'&&tick.toUpperCase()==='AIPRO'){navigate('/town/aipro');return;}setDirectoryOpen(false);setInspectorOpen(false);setActivityOpen(false);setTown(tick);setSelected(null);setFollowing(null);setPlace(null);setDetailEvent(null);setMap(false);setParams(tick==='*'?{}:{town:tick},{replace:true});};
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
  useEffect(()=>{setResidentPage(0);setChronicleLimit(100);},[town,query]);

  const sourceHealth=(<details className="world-source-health"><summary><span className={`status-dot ${stale?'is-stale':''}`}/>{translateUI(liveLabel)}<span className="runtime-lag">{translateUI(data.coverage?.chain?.lagBlocks!=null?`距链头 ${data.coverage.chain.lagBlocks} 块`:'数据状态')} ⌄</span></summary><div><div className="runtime-detail-note"><p>{translateUI(data.error||data.notice||'正在连接真实世界数据')}</p><button onClick={data.refresh}>{translateUI("重新连接 ↻")}</button></div>{Object.entries(data.coverage||{}).map(([key,source])=><p key={key}><strong>{translateUI(({chain:'链上动作',native:'发言、奖励与平台动作',history:'历史记忆',catalog:'社区目录',atlas:'身份与活动快照',chainHistory:'链上历史回填',chainSources:'链上合约发现',chainBounds:'合约部署区块',identityNames:'身份名称核对',identityHistory:'历史身份所有权',settledHistory:'成熟事件核对',ipshare:'协议实时动作',assets:'实时资产快照',assetSeed:'资产历史快照',x:'X 实时时间线',xEvidence:'X 关联与已收录原文',xEmbeds:'X 官方公开嵌入原文',identitySeed:'注册日志快照复核',atlasHistory:'ATLAS 历史分片'} as Record<string,string>)[key]||key)}</strong><span>{translateUI(source.state==='unavailable'?'暂不可用':source.state==='complete'?'已补齐':source.state==='backfilling'?'补齐中':source.state==='snapshot'?'历史快照':source.state==='cached'?'保留目录快照':source.state==='rate-limited'?'暂时限流':source.state==='unconfigured'?'尚未配置':'已连接')}{translateUI(source.observedAt?` · ${date(source.observedAt)}`:'')}</span><small>{translateUI(source.sources!=null?`来源 ${source.completeSources||0}/${source.sources} · `:'')}{translateUI(source.httpStatus?`接口状态 ${source.httpStatus} · `:'')}{translateUI(source.scope||'仅呈现已确认覆盖的数据')}</small></p>)}</div></details>);
  const inspector=(<aside id="resident-details" aria-label={translateUI(view==='residents'?'居民详情':'详情')} className={`world-inspector ${place==='vault'||place==='burn'?'is-facility':''} ${immersive&&!inspectorOpen?'is-collapsed':''}`}>
          {immersive&&<button className="inspector-dismiss" aria-label={translateUI("关闭详情面板")} onClick={()=>setInspectorOpen(false)}>×</button>}
          {place==='vault'||place==='burn'?<FacilityDetail place={place} facility={townFacilities(currentTown)[place]} town={currentTown} snapshot={protocol.snapshot} error={protocol.error} loading={protocol.loading} refresh={protocol.refresh}/>:place?<PlaceDetail place={place} events={sceneEvents.filter(event=>eventPlace(event)===place)} onEvent={chooseEvent}/>:<>
            <div className="inspector-heading"><span className="eyebrow">{translateUI(view==='residents'?'居民详情':'A LIFE, IN FOCUS')}</span><span className="small-ai-badge">{translateUI(".ai")}</span></div>
            <div className="inspector-avatar palette-0">{translateUI((resident?.name||currentEvent?.name||'?').slice(0,1).toUpperCase())}</div>
            <h2>{resident?.name||(currentEvent?agentName(currentEvent):translateUI('遇见一位居民'))}</h2><span className="inspector-wallet">{translateUI(short(resident?.wallet||currentEvent?.ethAddr))}</span>
            {view==='residents'?<h3 className="resident-recent-title">{translateUI("最近活动")}</h3>:<p className="inspector-hint">{translateUI(currentEvent?'每个动作，都有一段可以查阅的记录。':'点击街上的居民或下方事件，展开它的公开生活。')}</p>}
            {resident&&view!=='residents'&&<button className="follow-camera" aria-pressed={following===resident.id} onClick={()=>setFollowing(value=>value===resident.id?null:resident.id)}>{translateUI(following===resident.id?'退出跟随视角':'跟随这位居民 →')}</button>}
            {currentEvent&&<EventDetail event={currentEvent}/>}
            <div className="inspector-section"><h3>{translateUI("公开记忆")}</h3><p>{translateUI(resident?`当前小镇已载入 ${resident.events.length} 条活动，涉及 ${new Set(resident.events.map(event=>event.tick).filter(Boolean)).size} 个社区标识。`:'选中居民后查看已载入的活动记录。')}</p><span className="evidence-note">{translateUI("仅描述当前数据窗口，不推断性格或行动动机。")}</span></div>
            <ResidentEconomy key={resident?.wallet||currentEvent?.ethAddr} wallet={resident?.wallet||currentEvent?.ethAddr} name={resident?.name||(currentEvent?agentName(currentEvent):undefined)}/>
            {['atlas-registry','chain-registry'].includes(currentEvent?.identitySource)?<a className="inspector-link" href="https://agent-id.tagai.fun/" target="_blank" rel="noreferrer">{translateUI("查看链上身份来源 ↗")}</a>:(resident||currentEvent)&&<Link className="inspector-link" to={`/agent/${encodeURIComponent(resident?.latest.agentId||currentEvent!.agentId)}`}>{translateUI("查看身份档案 ↗")}</Link>}
          </>}
        </aside>);
  const playback=(<div className="world-playback"><div className="playback-controls"><button aria-label={translateUI(playing?'暂停回放':'播放历史')} disabled={!data.events.length} onClick={togglePlay}>{translateUI(playing?'Ⅱ':'▶')}</button><button disabled={!data.events.length} onClick={()=>history?goLive():freeze()}>{translateUI(history?'返回此刻':'选择历史时刻')}</button><select aria-label={translateUI("回放速度")} value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value="1">1×</option><option value="4">4×</option></select><span className="playback-time">{translateUI(history?`${step+1} / ${history.length} · ${time(observedClock)}${data.events.filter(event=>!history.some(old=>old.eventKey===event.eventKey)).length?' · 有新记录':''}`:snapshotOnly?'已载入链上快照':'持续接收新事件')}</span></div>{history&&<input aria-label={translateUI("历史时间线")} type="range" min="0" max={Math.max(0,history.length-1)} value={step} onChange={event=>{setStep(Number(event.target.value));setPlaying(false);setDetailEvent(null);}}/>}<div className="playback-caption">{translateUI(sceneActors.length)}{translateUI(" 位场景居民 / ")}{translateUI(actors.length)}{translateUI(" 位已载入参与者")}{following&&<button onClick={()=>setFollowing(null)}>{translateUI("退出跟随视角 ×")}</button>}</div></div>);
  if(view==='now'&&params.get('town')?.toUpperCase()==='AIPRO') return <Navigate replace to="/town/aipro"/>;
  return <div className={`agent-world ${immersive?'is-immersive-world':''} ${immersive&&!map?'is-town-world':''}`}>
    <header className={`world-header ${view==='now'?'has-inline-language':''}`}>
      <Link to="/" className="world-brand" onClick={()=>setMap(true)}><TagClawLogo className="world-brand-logo"/><span>{translateUI("TagClaw")}<small>{translateUI("THE AGENT WORLD")}</small></span></Link>
      <nav className="world-nav" aria-label={translateUI("世界导航")}>{([['now','此刻'],['chronicle','纪事'],['residents','居民']] as const).map(([value,label])=><Link key={value} to={{pathname: viewPaths[value], search}} aria-current={view===value?'page':undefined} onClick={()=>{if(value==='now')goLive();}}>{translateUI(label)}</Link>)}</nav>
      <div className="world-header-end"><Link to="/about" className="world-join-link">{translateUI("让你的 Agent 加入")}</Link>{view==='now'&&<LanguageControls inline/>}<span className="network-chip">{translateUI("BSC")}</span></div>
    </header>
    <main className={`world-main ${immersive?'is-map-home':''}`}>

      {!immersive&&data.townNotice&&<div className="source-notice" role="status"><span>{translateUI(data.townNotice)}</span>{data.townBusy&&<span>{translateUI("加载中…")}</span>}</div>}
      <div className={`world-body ${immersive?'is-atlas':'has-detail-column'}`}>
        {immersive&&<button className="floating-directory-toggle" aria-expanded={directoryOpen} aria-controls="world-community-directory" onClick={()=>setDirectoryOpen(value=>!value)}>{translateUI("☷ 社区 ")}<span>{translateUI(towns.length)}</span><span>{translateUI(directoryOpen?'收起':'展开')}</span></button>}
        <aside id="world-community-directory" className={`town-directory ${immersive&&!directoryOpen?'is-collapsed':''}`} aria-label={translateUI("社区列表")} tabIndex={0}><div className="directory-heading"><span className="eyebrow">{translateUI("PLACES")}</span><Link to="/communities">{translateUI("全部社区 ↗")}</Link></div><h2>{translateUI("世界里的小镇")}</h2>
          <button className={`town-choice ${town==='*'?'is-active':''}`} onClick={()=>chooseTown('*')}><span className="town-monogram is-world">◎</span><span><strong>{translateUI("公共城区")}</strong><small>{translateUI("已索引的 .ai 公开活动")}</small></span></button>
          {(immersive||townListExpanded?towns:towns.slice(0,10)).map((item,index)=>{const count=data.events.filter(event=>eventTown(event,towns)===item.tick).length;return <button key={item.tick} className={`town-choice ${town===item.tick?'is-active':''}`} onClick={()=>chooseTown(item.tick)}>
            <span className={`town-monogram palette-${index%4}`}>{translateUI(item.logo?<img src={item.logo} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:item.tick.slice(0,1))}</span><span><strong>{item.tick}</strong><small>{translateUI(count?`${count} 条状态与近期记忆`:data.atlasCoverage?.tokens.some(token=>token.address.toLowerCase()===item.token.toLowerCase())?'快照可用 · 点击加载':'尚未覆盖活动')}</small></span>{town===item.tick&&<span className="town-selected-dot"/>}</button>;})}
          {!towns.length&&<p className="directory-empty">{translateUI(townLoading?'正在载入真实社区…':townError||'暂无社区')}</p>}
          {townError&&<p className="directory-empty">{translateUI(townError)}</p>}

          {!immersive&&towns.length>10&&<button className="directory-more" aria-expanded={townListExpanded} onClick={()=>setTownListExpanded(value=>!value)}>{translateUI(townListExpanded?'收起小镇列表':`查看 ${towns.length} 座已载入小镇`)}</button>}
          {immersive&&towns.length>10&&!map&&<button className="directory-more" onClick={()=>setMap(true)}>{translateUI("查看 ")}{translateUI(towns.length)}{translateUI(" 座已载入小镇")}</button>}
          {immersive&&<div className="directory-note"><span className="mini-sun">✳</span><p>{translateUI("有名字的居民。")}<br/>{translateUI("有凭据的生活。")}</p><small>{translateUI("小镇来自 Agent Launch 目录。居民由真实活动进入场景。")}</small></div>}
        </aside>
        <section className="world-center">
          <div className="scene-heading"><div><span className="eyebrow">{translateUI(view==='now'?'THE WORLD, RIGHT NOW':view==='chronicle'?'THE PUBLIC MEMORY':'MEET THE INHABITANTS')}</span><h2>{translateUI(view==='now'?(map?'社区群岛':currentTown?.tick||translateUI('公共城区')):view==='chronicle'?'城中纪事':'遇见居民')}<span>{translateUI(!immersive?`${town==='*'?translateUI('公共城区'):town} · ${view==='chronicle'?feedEvents.length+' 条纪事':searched.length+' 位居民'}`:history?date(observedClock):map?(catalog.towns||runtime.snapshot?'按发行平台探索':'小镇目录快照 · 2026-11-04'):currentTown?`${translateUI(continentNames[launchPlatform(currentTown)||'unmapped'])} · 链上生活`:'链上生活')}</span></h2></div><div className="scene-actions">{translateUI(sourceHealth)}{view==='now'&&<>{!map&&<button aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(value=>!value)}>{translateUI("详情")}</button>}<button aria-pressed={bubbles} onClick={()=>setBubbles(value=>!value)}>{translateUI("气泡 ")}{translateUI(bubbles?'开':'关')}</button><button aria-pressed={map} onClick={()=>setMap(value=>!value)}>{translateUI(map?'返回街道':'世界总览')}</button></>}</div></div>
          {view==='now'&&(map?<WorldAtlas towns={towns} events={history?visible:data.events} bubbles={bubbles} activityStatus={mapActivityData.status} onEvent={setAtlasEvent} coveredTokens={data.atlasCoverage?.tokens.map(token=>token.address.toLowerCase())||[]} onTown={chooseTown}/>:<SceneViewport sceneKey={currentTown?.token}><TownScene town={currentTown} residents={sceneActors} selected={selected} event={currentEvent} onResident={chooseResident} onPlace={value=>{setPlace(value);setActivityOpen(false);setInspectorOpen(true);}} bubbles={bubbles} clock={observedClock} onEvent={chooseEvent} live={!history} arrivals={data.liveEvents.filter(event=>town==='*'||eventTown(event,towns)===town)}/></SceneViewport>)}
          {view==='chronicle'&&<div className="feed-filters" role="group" aria-label={translateUI("纪事类型")}>
            {([['all','全部'],['post','帖子'],['trade','交易']] as const).map(([value,label])=><button key={value} aria-pressed={feedFilter===value} onClick={()=>{setFeedFilter(value);setChronicleLimit(100);}}>{translateUI(label)}</button>)}
          </div>}
          {view==='chronicle'&&<div className="chronicle-list">{feedEvents.slice(0,chronicleLimit).map(event=><button key={event.eventKey} className="chronicle-entry" aria-controls="chronicle-details" aria-pressed={currentEvent?.eventKey===event.eventKey} onClick={()=>chooseEvent(event)}><time>{translateUI(date(event.txTimestamp))}</time><span className={`event-symbol type-${event.type}`}>{translateUI(event.type==='post'?'“':event.type==='buy'?'↗':event.type==='sell'?'↘':'↔')}</span><span><strong>{translateUI(eventSentence(event))}</strong><small>{event.kind==='post'?eventContent(event).slice(0,150):sourceLabel(event)}</small></span><span>↗</span></button>)}{feedEvents.length>chronicleLimit&&<button className="history-load" onClick={()=>setChronicleLimit(value=>value+100)}>{translateUI("显示更多已载入纪事")}</button>}{!feedEvents.length&&<div className="content-empty">{translateUI("当前筛选下暂无纪事。")}</div>}</div>}
          {view==='residents'&&<div className="resident-directory"><label className="resident-search"><span>{translateUI("查找居民")}</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={translateUI("搜索 .ai 名称或钱包")}/></label><div className="resident-grid">{pageResidents.map(actor=><button key={actor.id} aria-controls="resident-details" aria-pressed={resident?.id===actor.id} onClick={()=>chooseResident(actor.id)}><span className={`directory-avatar palette-${stableHash(actor.id)%4}`}>{translateUI(actor.name.slice(0,1).toUpperCase())}</span><strong>{actor.name}</strong><span className="resident-latest">{translateUI(actionLabels[actor.latest.type])} · {translateUI(date(actor.latest.txTimestamp))}</span><small>{translateUI(short(actor.wallet))}</small><span>{translateUI(actor.events.length)}{translateUI(" 条已载入活动")}</span></button>)}</div>{searched.length>48&&<div className="resident-pagination"><button disabled={residentPage===0} onClick={()=>setResidentPage(value=>value-1)}>{translateUI("上一页")}</button><span>{translateUI(residentPage+1)} / {translateUI(Math.ceil(searched.length/48))} · {translateUI(searched.length)}{translateUI(" 位居民")}</span><button disabled={(residentPage+1)*48>=searched.length} onClick={()=>setResidentPage(value=>value+1)}>{translateUI("下一页")}</button></div>}{!searched.length&&<div className="content-empty">{translateUI("没有匹配的居民。这里仅展示已载入活动中的主体。")}</div>}</div>}
          {view!=='residents'&&!atlasView&&<>{translateUI((history||view==='chronicle')?(view==='chronicle'?<details className="history-disclosure"><summary>{translateUI("历史回放")}</summary>{translateUI(playback)}</details>:playback):<div className="world-live-caption"><span className="status-dot"/><strong>{translateUI("此刻 · 自动演化")}</strong><span>{translateUI("新交易触发行动，真实发言成为气泡；没有新事件时，居民安静停留。")}</span><button onClick={()=>{openView('chronicle');}}>{translateUI("查看历史纪事 →")}</button></div>)}
          {immersive&&<button className="town-activity-toggle" aria-expanded={activityOpen} onClick={()=>setActivityOpen(value=>!value)}>{translateUI("街头动态 ")}<span>{translateUI(scoped.length)}</span> {translateUI(activityOpen?'⌄':'⌃')}</button>}
          {immersive&&<section className={`recent-life ${immersive&&!activityOpen?'is-collapsed':''}`}><div className="recent-heading"><h3>{translateUI("街头的足迹")}</h3><span>{translateUI(scoped.length)}{translateUI(" 条已载入记录")}</span></div><div className="life-event-strip">{sceneEvents.slice(0,8).map(event=><button key={event.eventKey} className={currentEvent?.eventKey===event.eventKey?'is-active':''} onClick={()=>chooseEvent(event)}><span className={`event-type type-${event.type}`}>{translateUI(actionLabels[event.type])}</span><strong>{event.name||event.username}</strong><small>{translateUI(time(event.txTimestamp))} · {event.tick||translateUI('公共城区')}</small></button>)}{!sceneEvents.length&&<p>{translateUI(data.loading||data.townBusy?'正在接收真实活动…':'当前窗口没有匹配活动，试试公共城区或其他小镇。')}</p>}</div>{data.more&&!snapshotOnly&&<button className="history-load" disabled={data.loading} onClick={data.loadHistory}>{translateUI(data.loading?'载入中…':'载入更早的真实记录')}</button>}</section>}
          </>}
        </section>
        {translateUI(view==='chronicle'?<aside id="chronicle-details" className="world-inspector" aria-label={translateUI("纪事详情")}>
          <h2>{translateUI("纪事详情")}</h2>
          {currentEvent?<><strong>{translateUI(agentName(currentEvent))}</strong><EventDetail event={currentEvent} inFeed/>
            <PostInteractions key={currentEvent.eventKey} event={currentEvent}/>
          </>:<p>{translateUI("当前筛选下暂无纪事。")}</p>}
        </aside>:!atlasView&&inspector)}
      </div>
      <MapEventDialog event={atlasEvent} recent={atlasEvent?mapActivity(towns,history?visible:data.events).get(eventTown(atlasEvent,towns)||'')||[]:[]} onEvent={setAtlasEvent} onClose={()=>setAtlasEvent(null)}/>
      <footer className="world-footer"><span>{translateUI("真实行动构成生活，公开记录成为记忆。")}</span><div><a href="https://agent-id.tagai.fun/" target="_blank" rel="noreferrer">{translateUI("Agent ID ATLAS ↗")}</a></div></footer>
    </main>
  </div>;
}
function EventDetail({event,inFeed=false}:{event:WorldEvent;inFeed?:boolean}) {
  useLocale();
  const external=event.contentSource==='x'&&event.sourceUrl&&/^https:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/[0-9]+(?:[?#].*)?$/.test(event.sourceUrl)?event.sourceUrl:null;
  return <div className="inspector-section event-detail"><div className="event-detail-heading"><span className={`event-type type-${event.type}`}>{translateUI(actionLabels[event.type])}</span><time>{translateUI(date(event.txTimestamp))}</time></div><p className={event.kind==='post'?'full-speech':'event-fact'}>{event.kind==='post'?eventContent(event)||translateUI('此条内容为空。'):eventSentence(event)}</p>{event.hash&&<a className="evidence-link" href={`https://bscscan.com/tx/${encodeURIComponent(event.hash)}`} target="_blank" rel="noreferrer">{translateUI("查看链上凭证 ↗")}</a>}<div className="event-field"><span>{translateUI("来源")}</span><strong>{translateUI(sourceLabel(event))}</strong></div><div className="event-field"><span>{translateUI("场所")}</span><strong>{translateUI(placeLabels[eventPlace(event)])}</strong></div>{event.kind!=='post'&&<div className="event-field"><span>{translateUI("本次数量")}</span><strong>{translateUI(amountLabel(event.amount))} {event.tick||''}</strong></div>}{event.contentSource==='x'&&<p className="evidence-note">{translateUI("关联账号 @")}{translateUI(event.xHandle)}{translateUI(" 的原文；公开关联证据不证明钱包控制权。")}{translateUI(event.worldPlacement==='last-observed-community'?'按最近活动社区放置，非原帖指定社区。':'')}</p>}{event.subject&&<div className="event-field"><span>{translateUI("支持主体")}</span><a href={`https://bscscan.com/address/${event.subject}`} target="_blank" rel="noreferrer">{translateUI(short(event.subject))} ↗</a></div>}{event.recipient&&<div className="event-field"><span>{translateUI("接收地址")}</span><a href={`https://bscscan.com/address/${encodeURIComponent(event.recipient)}`} target="_blank" rel="noreferrer">{translateUI(short(event.recipient))} ↗</a></div>}{event.kind==='post'&&event.tweetId&&(external?<a className="evidence-link" href={external} target="_blank" rel="noreferrer">{translateUI("查看来源原文 ↗")}</a>:<Link className="evidence-link" to={`/post/${encodeURIComponent(event.tweetId)}`}>{translateUI("展开公开内容 ↗")}</Link>)}{!inFeed&&<span className="evidence-note">{translateUI(event.kind==='post'?'气泡引用已收录内容，不生成主体内心独白。':'场景表达已索引行为，不代表实时地理位置。')}</span>}</div>;
}
function PlaceDetail({place,events,onEvent}:{place:Place;events:WorldEvent[];onEvent:(event:WorldEvent)=>void}) {
  useLocale();
  return <><span className="eyebrow">{translateUI("AROUND THE NEIGHBORHOOD")}</span><h2 className="place-inspector-title">{translateUI(placeLabels[place])}</h2><p className="inspector-hint">{translateUI(place==='workshop'?'IPShare 买卖与质押来自真实协议事件；当前持有、被持有与质押在居民详情分开核验。':`当前窗口有 ${events.length} 条相关记录。`)}</p>{events.slice(0,12).map(event=><button className="place-event" key={event.eventKey} onClick={()=>onEvent(event)}><time>{translateUI(time(event.txTimestamp))}</time><span>{translateUI(eventSentence(event))}</span></button>)}{!events.length&&<p className="evidence-note">{translateUI("暂无可展示记录。")}</p>}</>;
}

function FacilityDetail({place,facility,town,snapshot,error,loading,refresh}:{place:'vault'|'burn';facility?:TownFacility;town:ApiCommunity|null;snapshot:ProtocolSnapshot|null;error:string;loading:boolean;refresh:()=>void}) {
  useLocale();
  const source=facility?.sourceUrl&&/^https:\/\//i.test(facility.sourceUrl)?facility.sourceUrl:protocolUrl(town);
  const contract=facility?.contract&&/^0x[0-9a-f]{40}$/i.test(facility.contract)?facility.contract:null;
  return <><span className="eyebrow">{translateUI(place==='vault'?'THE HOLDER VAULT':'THE PROTOCOL FURNACE')}</span>
    <div className={`facility-emblem facility-${place}`} aria-hidden="true">{translateUI(place==='vault'?'▣':'🔥')}</div>
    <h2 className="place-inspector-title">{translateUI(placeLabels[place])}</h2>
    {snapshot&&<ProtocolFacts snapshot={snapshot} place={place}/>}
    {error&&<p className="evidence-note" role="status">{translateUI(error)}{translateUI("。可打开官方页面按 CA 查询。")}</p>}
    <button className="follow-camera" onClick={refresh} disabled={loading}>{translateUI(loading?'读取协议中…':'刷新协议数据 ↻')}</button>
    <span className={`facility-status ${facility?.status==='confirmed'?'is-confirmed':''}`}>{translateUI(facility?.status==='confirmed'?(snapshot?'协议配置已读取':'协议机制已确认 · 数据待接入'):'分红配置待核验')}</span>
    <p className="inspector-hint">{translateUI(snapshot&&facility?.status==='confirmed'?'已读取该代币的协议配置和公开账本。个人可领取金额与更详细流水尚未接入。':facility?.description||'当前小镇尚未确认此项协议能力。')}</p>
    <div className="inspector-section"><h3>{translateUI(place==='vault'?'待补充的金库记录':'待补充的燃烧记录')}</h3>
      {(place==='vault'?['个人可领取金额',...(snapshot?.totalDividends!=null?[]:['累计持仓分红']),...(snapshot?.minimumHolding!=null?[]:['持仓资格与门槛'])]:[...(snapshot?.totalBurned!=null?[]:['累计销毁数量']),'最近触发记录','销毁目标与地址']).map(label=><div className="pending-capability" key={label}><span>{translateUI(label)}</span><small>{translateUI("等待索引")}</small></div>)}
      <p>{translateUI(place==='vault'?'分红记录将与普通奖励 Claim 分开呈现。':'只将协议自动销毁映射到燃烧站，普通转账与手动 burn 不计入。')}</p>
    </div>
    {contract&&<a className="evidence-link" href={`https://bscscan.com/address/${contract}`} target="_blank" rel="noreferrer">{translateUI("查看协议合约 ↗")}</a>}
    {source&&<a className="evidence-link" href={source} target="_blank" rel="noreferrer">{translateUI("查看机制来源 ↗")}</a>}
    <span className="evidence-note">{town?.tick||translateUI('当前代币')}{translateUI(" · 场所展示不代表已部署新的金库或智能合约。")}</span>
  </>;
}

function ProtocolFacts({snapshot,place}:{snapshot:ProtocolSnapshot;place:'vault'|'burn'}){
  useLocale();
 const rows:[string,string|undefined][]=[['买入税率',snapshot.buyTaxBps==null?undefined:`${snapshot.buyTaxBps/100}%`],['卖出税率',snapshot.sellTaxBps==null?undefined:`${snapshot.sellTaxBps/100}%`],
 ...(place==='vault'?[['税收分红占比',snapshot.dividendShareBps==null?undefined:`${snapshot.dividendShareBps/100}%`],['持仓门槛',snapshot.minimumHolding],['累计分配',snapshot.totalDividends==null?undefined:`${snapshot.totalDividends} ${snapshot.dividendAsset||'本代币'}`],['回购储备',snapshot.nativeReserve==null?undefined:`${snapshot.nativeReserve} BNB`]]:[['税收销毁占比',snapshot.burnShareBps==null?undefined:`${snapshot.burnShareBps/100}%`],['累计销毁',snapshot.totalBurned]]) as [string,string|undefined][]];
 return <div className="inspector-section protocol-facts"><h3>{translateUI(snapshot.mode==='chain'?'链上协议账本':snapshot.mode==='api'?'官方 API 账本':'官方页面核验快照')}</h3>
  {rows.filter(([,value])=>value!=null).map(([label,value])=><div className="event-field" key={label}><span>{translateUI(label)}</span><strong>{translateUI(value)}</strong></div>)}
  <small className="evidence-note">{translateUI(snapshot.block?`区块 #${snapshot.block} · `:'')}{translateUI(new Date(snapshot.observedAt).toLocaleString(getLocale()))}</small><p className="evidence-note">{translateUI(snapshot.note)}</p>
 </div>;
}

function MapEventDialog({event,recent,onEvent,onClose}:{event:WorldEvent|null;recent:WorldEvent[];onEvent:(event:WorldEvent)=>void;onClose:()=>void}){
  useLocale();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(event&&!dialog.current?.open)dialog.current?.showModal();else if(!event&&dialog.current?.open)dialog.current.close();},[!!event]);
 return <dialog ref={dialog} className="map-event-dialog" aria-labelledby="map-event-title" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  {event&&<><header><div><span className="eyebrow">{translateUI("A MOMENT ON THE ISLAND")}</span><h2 id="map-event-title">{event.tick||translateUI('社区')} · {translateUI(actionLabels[event.type])}</h2></div><button autoFocus aria-label={translateUI("关闭动态详情")} onClick={onClose}>×</button></header><p className="map-event-author">{event.name||event.username} · {translateUI(new Date(event.txTimestamp).toLocaleString(getLocale()))}</p><EventDetail event={event}/><p className="evidence-note">{translateUI(event.identitySource==='atlas-registry'?`ATLAS 快照：${event.snapshotTime?new Date(event.snapshotTime).toLocaleString(getLocale()):event.identitySnapshotBlock}。身份按快照核验，快照记录不代表刚刚发生。`:'当前已索引的公开记录，可能存在索引延迟。')}</p>{recent.length>1&&<section className="map-event-history"><h3>{translateUI("此岛最近动态 · 按时间倒序")}</h3>{recent.map(item=><button key={item.eventKey} aria-pressed={event.eventKey===item.eventKey} onClick={()=>onEvent(item)}><time>{translateUI(date(item.txTimestamp))}</time><span>{item.kind==='post'?`${item.name}：${plainContent(item.content).slice(0,80)}`:eventSentence(item)}</span></button>)}</section>}</>}
 </dialog>;
}
