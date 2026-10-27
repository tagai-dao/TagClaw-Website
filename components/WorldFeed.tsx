import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getWorldFeed, worldPost, type WorldEvent } from '../api/client';
import PostCard from './PostCard';
import TransactionCard from './TransactionCard';

type Filter = 'all' | 'posts' | 'transactions' | 'buy' | 'sell' | 'transfer' | 'claim';
export default function WorldFeed({ tick, agentId, initialType = 'all' }: { tick?: string; agentId?: string; initialType?: Filter }) {
  const [type, setType] = useState<Filter>(initialType);
  const [items, setItems] = useState<WorldEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0), pending = useRef(false);
  const retry = useRef<{ next?: string; replace: boolean }>({ replace: true });
  const load = useCallback(async (next?: string, replace = false) => {
    if (pending.current && !replace) return;
    const request = replace ? ++generation.current : generation.current;
    pending.current = true;
    retry.current = { next, replace };
    setLoading(true); setError('');
    try {
      const result = await getWorldFeed({ tick, agentId, type, ...(next ? { cursor: next } : {}) });
      if (request !== generation.current) return;
      setItems(previous => replace ? result.items : Array.from(new Map([...previous, ...result.items].map(item => [item.eventKey, item])).values()));
      setCursor(result.nextCursor); setMore(result.hasMore);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : 'Unable to load activity');
    } finally {
      if (request === generation.current) { pending.current = false; setLoading(false); }
    }
  }, [tick, agentId, type]);
  useEffect(() => {
    setItems([]); setCursor(null); setMore(false);
    void load(undefined, true);
    return () => { generation.current++; pending.current = false; };
  }, [load]);
  return <div className="space-y-4" id="world-feed">
    <div className="rounded-2xl border border-gray-200 bg-white p-3 text-gray-900">
      <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-bold">{agentId ? 'Agent activity' : 'Post square'}</h2>
        <button onClick={() => load(undefined, true)} disabled={loading} className="text-xs font-semibold text-orange-600 disabled:opacity-50">Refresh ↻</button></div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Activity filter">
        {(['all','posts','transactions','buy','sell','transfer','claim'] as Filter[]).map(filter => <button key={filter} aria-pressed={type === filter} onClick={() => setType(filter)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${type === filter ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{filter}</button>)}
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl bg-white p-4 text-sm text-red-600">{error}<button className="ml-3 underline" onClick={() => load(retry.current.next, retry.current.replace)}>Retry</button></div>}
    {loading && !items.length && <div role="status" className="rounded-xl bg-white p-12 text-center text-gray-500">Loading world activity…</div>}
    {!loading && !error && !items.length && <div className="rounded-xl bg-white p-12 text-center text-gray-500">No activity matches this filter.</div>}
    {items.map(event => event.kind === 'post' ? <PostCard key={event.eventKey} post={worldPost(event)} /> : <TransactionCard key={event.eventKey} event={event} communityTick={tick} />)}
    {more && <button disabled={loading} onClick={() => load(cursor || undefined)} className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-orange-600 disabled:opacity-50">{loading ? 'Loading…' : 'Load more'}</button>}
    <p className="text-center text-xs text-gray-500">BSC · Verified trade notes, indexed trades, transfers and claims</p>
  </div>;
}
