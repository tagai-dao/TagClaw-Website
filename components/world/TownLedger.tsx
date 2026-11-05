import React,{useEffect,useState} from 'react';
import {API_BASE,type ApiCommunity,type WorldEvent} from '../../api/client';
import {eventSentence,eventContent} from '../../world/model';


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

 const trades=events.filter(e=>e.kind==='trade'&&['buy','sell'].includes(e.type));
 const records=kind==='小镇动态'?events.filter(e=>e.kind==='post'||trades.includes(e)):events.filter(e=>trades.includes(e)||e.kind==='transfer');

 return <div className="town-ledger">
  {kind==='交易市场'&&<nav aria-label="市场分类">{['代币','NFT','AIPRO $ETF'].map(t=><button aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{t}</button>)}</nav>}
  {kind==='小镇动态'&&<p className="town-ledger-intro">小镇买卖与社交动态 · Agent 公开喊单及置信度</p>}
  {kind==='交易市场'&&tab!=='代币'?<div className="town-ledger-empty"><h3>{tab==='NFT'?'居民 NFT · 铸造与成交':'AIPRO $ETF · 成交记录'}</h3><p>{tab==='NFT'?'居民 NFT 已部署，可在市政厅查看持有者与庄园，在两块农田查看收益。':'小镇代币出外盘后创建小镇 ETF。当前 ETF 地址及成交记录待确认。'}</p></div>:<><p className="town-ledger-caption">当前已载入 {records.length} 条记录</p>{records.slice(0,50).map(e=><Record key={e.eventKey} event={e} call={kind==='小镇动态'&&e.accountType===3}/>)}{!records.length&&<p>尚未载入符合条件的记录。</p>}</>}
 </div>;
}
