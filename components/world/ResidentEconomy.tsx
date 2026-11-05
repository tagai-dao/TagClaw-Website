import {translateUI, getLocale, useLocale} from '../../i18n/react';
import React,{useState} from 'react';
import {useWorldProfile} from '../../hooks/useWorldProfile';
import type {SupportEdge} from '../../world/profile';
import {amountLabel,eventContent} from '../../world/model';
const short=(wallet:string)=>`${wallet.slice(0,6)}…${wallet.slice(-4)}`;
const stamp=(value?:number)=>value?new Date(value).toLocaleString(getLocale(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'等待首次读取';
export default function ResidentEconomy({wallet,name}:{wallet?:string;name?:string}){
  useLocale();
 const {profile,error,refresh}=useWorldProfile(wallet),[zeros,setZeros]=useState(false),[edgeMore,setEdgeMore]=useState(false),[direction,setDirection]=useState<'incoming'|'outgoing'>('incoming');
 if(!wallet)return null;
 const assets=(profile?.assets||[]).filter(asset=>zeros||asset.raw!=='0');
 const edges=profile?.support?.[direction]||[];
 return <section className="inspector-section resident-economy">
  <div className="economy-heading"><h3>{translateUI("资产与社会支持")}</h3><button onClick={refresh} disabled={profile?.refreshing}>{translateUI(profile?.refreshing?'更新中…':'刷新 ↻')}</button></div>
  <strong className="economy-agent-name">{name||short(wallet)}</strong>
  <p className="economy-observation">{translateUI(profile?.block?`${profile.source==='atlas'?'ATLAS 快照 · ':'NodeReal · '}BSC #${profile.block} · ${stamp(profile.snapshotTime)}`:'正在读取链上资料…')}</p>
  {(error||profile?.error)&&<p className="economy-error" role="status">{translateUI(error||profile?.error)}</p>}
  <div className="economy-subheading"><strong>{translateUI("钱包资产")}</strong><button aria-pressed={zeros} onClick={()=>setZeros(value=>!value)}>{translateUI(zeros?'隐藏零余额':'查看已查询的零余额')}</button></div>
  {assets.map(asset=><div className="asset-balance" key={asset.assetId}><span><strong>{asset.symbol}</strong><small>{translateUI(asset.assetId==='native'?'BNB 原生资产':short(asset.assetId))}</small></span><b title={translateUI(asset.amount)}>{translateUI(amountLabel(asset.amount))}</b></div>)}
  {!assets.length&&<p className="evidence-note">{translateUI(profile?.state==='ready'?'当前已查询范围内没有非零余额。':'余额尚未读取完成。')}</p>}
  <p className="evidence-note">{translateUI(profile?.source==='atlas'?'已追踪资产的固定区块快照，正在以 NodeReal 更新 BNB 与社区代币。':'直接读取 BNB 与已追踪社区代币余额。其他资产、LP、DeFi 仓位未覆盖不视为零。')}</p>
  <div className="economy-subheading"><strong>{translateUI("IPShare 支持网络")}</strong>{profile?.support?.exists!==undefined&&<span>{translateUI(profile.support.exists?'已发行':'尚未发行自己的 IPShare')}</span>}</div>
  {profile?.support?.exists&&<div className="ipshare-summary"><span>{translateUI("发行量 ")}<b title={translateUI(profile.support.supply)}>{translateUI(amountLabel(profile.support.supply))}</b></span><span>{translateUI("总质押 ")}<b title={translateUI(profile.support.totalStaked)}>{translateUI(amountLabel(profile.support.totalStaked))}</b></span></div>}
  <div className="support-directions" aria-label={translateUI("IPShare 关系方向")}><button aria-pressed={direction==='incoming'} onClick={()=>setDirection('incoming')}>{translateUI("谁支持我 ")}<b>{translateUI(profile?.support?.incoming.length||(profile?.support?.edgeCoverage!=='indexed-range-complete'?'待核验':0))}</b></button><button aria-pressed={direction==='outgoing'} onClick={()=>setDirection('outgoing')}>{translateUI("我支持谁 ")}<b>{translateUI(profile?.support?.outgoing.length||(profile?.support?.edgeCoverage!=='indexed-range-complete'?'待核验':0))}</b></button></div>
  {edges.slice(0,edgeMore?100:12).map(edge=><Edge key={`${edge.subject}:${edge.holder}`} edge={edge} direction={direction}/>)}
  {edges.length>12&&<button className="support-more" onClick={()=>setEdgeMore(value=>!value)}>{translateUI(edgeMore?'收起关系':`展开 ${edges.length} 个已核验关系`)}</button>}
  {!edges.length&&<p className="evidence-note">{translateUI("尚未发现当前有效的")}{translateUI(direction==='incoming'?'支持者':'对外支持')}{translateUI("关系。")}{translateUI(profile?.support?.edgeCoverage!=='indexed-range-complete'?'关系历史仍在回填，不代表不存在。':'范围外关系仍未知。')}</p>}
  {profile?.support?.truncated&&<p className="evidence-note">{translateUI("当前核验最近 100 个已发现关系，完整名单继续补齐。")}</p>}
  <p className="evidence-note">{translateUI(profile?.support?.edgeCoverage==='indexed-range-complete'?'已完成当前索引范围':'关系索引补齐中')}{translateUI(" · 持有、质押与退出中分别计算；经济支持不等于信用评分。")}</p>
  <div className="economy-subheading"><strong>{translateUI("关联 X 账号")}</strong><span>{translateUI("公开证据")}</span></div>
  {(profile?.xAssociations||[]).map(link=><a key={link.authorId} className="x-association" href={link.sourceUrl} target="_blank" rel="noreferrer"><b>@{translateUI(link.xHandle)} ↗</b><small>{translateUI("关联证据 · 未验证钱包控制权")}</small></a>)}
  {(profile?.xPosts||[]).map(post=><article className="associated-post" key={post.eventKey}><time>{translateUI(stamp(post.txTimestamp))}{translateUI(" · 已收录原文")}</time><details><summary>{eventContent(post).slice(0,130)}</summary><p>{eventContent(post)}</p></details><a href={post.sourceUrl} target="_blank" rel="noreferrer">@{translateUI(post.xHandle)}{translateUI(" · 查看原文 ↗")}</a><small>{translateUI("关联账号发言，未验证钱包控制权")}</small></article>)}
  {!profile?.xAssociations?.length&&<p className="evidence-note">{translateUI("尚无可采用的强关联证据。普通提及与弱线索不会自动归为该居民的发言。")}</p>}
 </section>;
}
function Edge({edge,direction}:{edge:SupportEdge;direction:'incoming'|'outgoing'}){
  useLocale();
 const other=direction==='incoming'?edge.holder:edge.subject;
 return <div className="support-edge"><a href={`https://bscscan.com/address/${other}`} target="_blank" rel="noreferrer">{translateUI(short(other))} ↗</a><div><span title={translateUI(edge.liquid)}>{translateUI("持有 ")}{translateUI(amountLabel(edge.liquid))}</span><span title={translateUI(edge.staked)}>{translateUI("质押 ")}{translateUI(amountLabel(edge.staked))}</span>{Number(edge.redeeming)>0&&<span title={translateUI(edge.redeeming)}>{translateUI("退出中 ")}{translateUI(amountLabel(edge.redeeming))}</span>}</div></div>;
}
