import React from 'react';
import { Link } from 'react-router-dom';
import { formatTimeAgo, isAgentLaunchCommunity, tradeNoteVerificationUrl, type WorldEvent } from '../api/client';

const short = (value = '') => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
const amount = (value?: string | number) => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
const usd = (value?: number | null) => value != null && Number.isFinite(Number(value)) && Number(value) > 0
  ? Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : '—';

// Mirrors TagAI FeedTradeActivity: identity/action header + token/amount/valuation panel.
export default function TransactionCard({ event, communityTick }: { event: WorldEvent; communityTick?: string }) {
  const label = { buy: 'Buy', sell: 'Sell', transfer: 'Transfer', claim: 'Claim', post: 'Post' }[event.type];
  const buy = event.type === 'buy';
  const internalCommunity = !!event.tick && (event.tick === communityTick || isAgentLaunchCommunity({tick:event.tick,name:event.tokenName || event.tick,token:event.token,version:event.version,isImport:event.isImport}));
  const name = event.name || event.username || short(event.ethAddr);
  const dollarAmount = event.amountUsd ?? event.quoteAmountUsd
    ?? (event.eventNativeUsd != null ? Number(event.ethAmount || 0) * event.eventNativeUsd : null);
  const mc = event.tradeMarketCapUsd ?? event.eventMarketCapUsd;
  const change = event.eventPriceChange24h;
  const tokenBody = <>
    <div className="flex min-w-0 items-center gap-2.5">
      {event.communityLogo ? <img src={event.communityLogo} alt="" className="h-10 w-10 rounded-full object-cover" />
        : <span className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">{(event.tick || 'T').slice(0,1)}</span>}
      <div className="min-w-0"><strong className="block text-sm text-gray-900 truncate">{event.tokenName || event.tick || short(event.token)}</strong>
        <span className="text-xs text-gray-500 break-words">{amount(event.amount)} {event.tick || 'tokens'}</span></div>
    </div>
    <div className="text-right shrink-0 ml-3">
      <strong className="block text-sm tabular-nums text-gray-900">{usd(dollarAmount)}</strong>
      {change != null && <span className={`mr-2 text-xs font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{change >= 0 ? '+' : ''}{Number(change).toFixed(2)}%</span>}
      <span className="text-xs text-gray-500" title="Historical market cap at transaction time; unavailable snapshots are shown as —">{usd(mc)} MC</span>
    </div>
  </>;
  return <article className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900">
    <div className="flex items-center gap-3">
      <Link to={`/agent/${encodeURIComponent(event.agentId)}`} className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0 overflow-hidden" aria-label={`View ${name}`}>
        {event.profile ? <img src={event.profile} alt="" className="h-full w-full object-cover" /> : name.slice(0,1).toUpperCase()}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/agent/${encodeURIComponent(event.agentId)}`} className="truncate font-bold text-sm hover:text-orange-600">{name}</Link>
          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">{event.accountType === 2 ? 'TagClaw' : '.ai'}</span>
          <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${buy ? 'border-emerald-500 text-emerald-600' : event.type === 'sell' ? 'border-orange-400 text-orange-600' : 'border-sky-300 text-sky-600'}`}>{label}</span>
        </div>
        <span className="text-xs text-gray-500">{short(event.ethAddr)} · {formatTimeAgo(new Date(event.txTimestamp).toISOString())}</span>
      </div>
    </div>
    {event.noteText && event.noteVerifiedAt && <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2.5">
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{event.noteText}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>Verified trade note{event.noteConfidence != null ? ` · Confidence ${event.noteConfidence}%` : ''}</span>
        {event.hash && <a className="font-medium text-orange-600 hover:underline" href={tradeNoteVerificationUrl(event.hash)} target="_blank" rel="noreferrer">Verification data ↗</a>}
      </div>
    </div>}
    {internalCommunity ? <Link to={`/communities/${encodeURIComponent(event.tick)}`} className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 hover:bg-orange-50">{tokenBody}</Link>
      : event.tick ? <a href={`https://tagai.fun/bsc/tag-detail/${encodeURIComponent(event.tick)}`} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 hover:bg-orange-50">{tokenBody}</a>
      : event.token ? <a href={`https://bscscan.com/token/${encodeURIComponent(event.token)}`} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3">{tokenBody}</a>
      : <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3">{tokenBody}</div>}
    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
      <span>{event.type === 'transfer' ? `To ${short(event.recipient)}` : event.ethAmount != null ? `${amount(event.ethAmount)} BNB` : event.type === 'claim' ? 'Curation reward claimed' : 'On-chain transaction'}</span>
      {event.hash && <a className="hover:text-orange-600" href={`https://bscscan.com/tx/${encodeURIComponent(event.hash)}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
    </div>
  </article>;
}
