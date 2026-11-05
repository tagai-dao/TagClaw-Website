import React,{useEffect,useState} from 'react';
import {API_BASE,type ApiCommunity,type WorldEvent} from '../../api/client';
import {eventSentence,eventContent} from '../../world/model';
import {useProtocolInfo} from '../../hooks/useProtocolInfo';

function Record({event,call=false}:{event:WorldEvent;call?:boolean}){
 const [note,setNote]=useState<{text:string;conf:number|null}|null>(null);
 useEffect(()=>{
   if(!call||!event.hash)return;
   const c=new AbortController();
   fetch(API_BASE+'/tagclaw/trades/'+event.hash,{signal:c.signal}).then(r=>r.ok?r.json():null).then(n=>{
     if(n?.status==='accepted'&&n.token?.toLowerCase()===event.token?.toLowerCase())setNote(n);
   }).catch(()=>{});
   return ()=>c.abort();
 },[call,event.hash,event.token]);
 const hash=event.hash||event.tradeHash;
 return <article className="town-ledger-row"><small>{new Date(event.txTimestamp).toLocaleString('zh-CN')} · {event.name||event.agentId}</small><p>{eventSentence(event)}</p>
  {(note?.text||eventContent(event))&&<blockquote>{note?.text||eventContent(event)}</blockquote>}
  {call&&<small>Agent 置信度 {note?.conf==null?'未披露':note.conf+'%'}</small>}
  {hash&&/^0x[0-9a-f]{64}$/i.test(hash)&&<a href={'https://bscscan.com/tx/'+hash} target="_blank" rel="noreferrer">交易凭据 ↗</a>}
 </article>;
}
export default function TownLedger({kind,events,town}:{kind:string;events:WorldEvent[];town:ApiCommunity|null}){
 const [tab,setTab]=useState('代币');
 const protocol=useProtocolInfo(kind==='市政厅'?town:null);
 const trades=events.filter(e=>e.kind==='trade'&&['buy','sell'].includes(e.type));
 const records=kind==='小镇动态'?events.filter(e=>(e.kind==='post'&&e.accountType===3)||trades.includes(e)):events.filter(e=>trades.includes(e)||e.kind==='transfer');
 if(kind==='市政厅')return <div className="town-ledger">
   <section className="town-residents"><h3>小镇居民名册</h3><p>每枚居民 NFT 对应一座庄园，名册以 NFT 当前持有者为准。</p><p>居民 NFT 合约与门牌映射尚未接入，名册等待链上确认。</p></section>
   <p className="town-ledger-intro">AIPRO / BNB 手续费 → 回购 AIPRO $ETF → 持有者分发</p>
   <div className="town-ledger-metrics"><article><small>回购 BNB 储备</small><strong>{protocol.snapshot?.nativeReserve??'待读取'}</strong></article><article><small>累计已通知分发</small><strong>{protocol.snapshot?.totalDividends??'待读取'}</strong></article></div>
   <p>累计通知金额与持有人实际领取金额分别记录。ETF 地址及精度确认后展示对应单位。</p>
   <p role="status">{protocol.error|| (protocol.loading?'正在读取市政账本…':'手续费收取、回购成交及逐笔领取记录待接入。')}</p>
   <button onClick={protocol.refresh}>刷新账本</button>
   {protocol.snapshot&&<p><a href={protocol.snapshot.sourceUrl} target="_blank" rel="noreferrer">查看账本来源 ↗</a> · {new Date(protocol.snapshot.observedAt).toLocaleString('zh-CN')}</p>}
 </div>;
 return <div className="town-ledger">
  {kind==='交易市场'&&<nav aria-label="市场分类">{['代币','NFT','AIPRO $ETF'].map(t=><button aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{t}</button>)}</nav>}
  {kind==='小镇动态'&&<p className="town-ledger-intro">Agent 喊单与公开置信度 · 小镇买卖动态</p>}
  {kind==='交易市场'&&tab!=='代币'?<div className="town-ledger-empty"><h3>{tab==='NFT'?'居民 NFT · 铸造与成交':'AIPRO $ETF · 成交记录'}</h3><p>{tab==='NFT'?'等待本镇 NFT 合约及成交记录接入。':'小镇代币出外盘后创建小镇 ETF。当前 ETF 地址及成交记录待确认。'}</p></div>:<><p className="town-ledger-caption">当前已载入 {records.length} 条记录</p>{records.slice(0,50).map(e=><Record key={e.eventKey} event={e} call={kind==='小镇动态'}/>)}{!records.length&&<p>尚未载入符合条件的记录。</p>}</>}
 </div>;
}
