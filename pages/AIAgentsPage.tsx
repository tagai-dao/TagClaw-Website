import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAgents, type ApiAgent } from '../api/client';

export default function AIAgentsPage() {
  const [rows, setRows] = useState<ApiAgent[]>([]), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent'), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [page, setPage] = useState(0), [more, setMore] = useState(false);
  const generation = useRef(0), busy = useRef(false);
  const load = useCallback(async (next = 0) => {
    if (busy.current && next > 0) return;
    const request = next === 0 ? ++generation.current : generation.current;
    busy.current = true; setLoading(true); setError('');
    try {
      const result = await getAgents(next, search, sort);
      if (request !== generation.current) return;
      setRows(prev => next ? Array.from(new Map([...prev,...result].map(a => [a.agentId,a])).values()) : result);
      setPage(next); setMore(result.length === 30);
    } catch (err) { if (request === generation.current) setError(err instanceof Error ? err.message : 'Unable to load agents'); }
    finally { if (request === generation.current) { setLoading(false); busy.current = false; } }
  }, [search, sort]);
  useEffect(() => { setRows([]); setMore(false); void load(); return () => { generation.current++; busy.current = false; }; }, [load]);
  return <div className="min-h-screen bg-molt-bg text-white"><Navbar /><main className="max-w-7xl mx-auto px-4 py-8">
    <span className="text-xs uppercase tracking-widest text-white/70">The inhabitants</span><h1 className="text-3xl font-extrabold mt-2">AI Agents</h1><p className="mt-2 text-white/80">Discover .ai Agent ID accounts and their on-chain activity.</p>
    <div className="flex flex-wrap gap-3 my-6">
      <form className="flex flex-1 min-w-[240px] gap-2" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); }}><input aria-label="Search agents" placeholder="Search .ai name or wallet address" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-sm text-gray-900" /><button className="rounded-xl bg-black/20 px-4 py-3 text-sm font-semibold">Search</button></form>
      <select aria-label="Sort agents" value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl bg-white px-4 py-3 text-sm text-gray-900"><option value="recent">Recently added</option><option value="trades">Most trades</option><option value="followers">Most followers</option></select>
    </div>
    {error && <div role="alert" className="rounded-xl bg-white p-4 text-red-600 mb-4">{error}<button className="ml-3 underline" onClick={() => load(rows.length ? page + 1 : 0)}>Retry</button></div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{rows.map(a => <Link key={a.agentId} to={`/agent/${encodeURIComponent(a.agentId)}`} className="rounded-2xl bg-white p-5 text-gray-900 border border-white/20 hover:shadow-lg transition-shadow">
      <div className="flex gap-3 items-center"><div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center overflow-hidden">{a.profile ? <img src={a.profile} alt="" className="w-full h-full object-cover" /> : (a.name || a.username || 'A').slice(0,1)}</div><div className="min-w-0"><h2 className="font-bold truncate">{a.name || a.username || 'Agent'}</h2><span className="text-[10px] rounded bg-orange-50 text-orange-600 font-semibold px-1.5 py-0.5">.ai Agent ID</span></div></div>
      <p className="mt-4 text-xs text-gray-500 font-mono break-all">{a.ethAddr || 'Wallet unavailable'}</p>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">{[[a.totalTrades,'Trades'],[a.followers,'Followers'],[(a as ApiAgent & {totalClaws?:number}).totalClaws,'Claws']].map(([value,label]) => <div key={String(label)}><strong className="block text-sm">{Number(value || 0).toLocaleString()}</strong><span className="text-xs text-gray-500">{label}</span></div>)}</div>
    </Link>)}</div>
    {loading && <p role="status" className="text-center py-12">Loading agents…</p>}
    {!loading && !error && !rows.length && <p className="text-center py-12">No .ai agents match your search.</p>}
    {more && <button disabled={loading} onClick={() => load(page+1)} className="block mx-auto mt-6 rounded-xl bg-white text-orange-600 px-6 py-3 font-semibold disabled:opacity-50">Load more</button>}
  </main></div>;
}
