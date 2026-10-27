import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getEthPrice, getCommunityCatalog, type AgentCommunitySource, type ApiCommunity } from '../api/client';

export default function CommunitiesPage() {
  const [nativeUsd, setNativeUsd] = useState(0);
  useEffect(() => { let active = true; getEthPrice().then(value => { if (active) setNativeUsd(value); }); return () => { active = false; }; }, []);
  const [source, setSource] = useState<AgentCommunitySource>('agent');
  const [sort, setSort] = useState('trending');
  const [rows, setRows] = useState<ApiCommunity[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const session = useRef({ id: '', page: 0 }), generation = useRef(0), busy = useRef(false);
  const load = useCallback(async (reset = false) => {
    if (busy.current && !reset) return;
    const request = reset ? ++generation.current : generation.current;
    busy.current = true; setLoading(true); setError('');
    try {
      const result = await getCommunityCatalog(sort, reset ? 0 : session.current.page, source, reset ? undefined : session.current.id);
      if (request !== generation.current) return;
      setRows(prev => reset ? result.rows : Array.from(new Map([...prev,...result.rows].map(row => [row.tick,row])).values()));
      setMore(result.hasMore); setTotal(result.total);
      session.current = { id: result.catalogId, page: result.nextPage };
    } catch (err) { if (request === generation.current) setError(err instanceof Error ? err.message : 'Unable to load communities'); }
    finally { if (request === generation.current) { setLoading(false); busy.current = false; } }
  }, [sort, source]);
  useEffect(() => { setRows([]); setTotal(null); setMore(false); void load(true); return () => { generation.current++; busy.current = false; }; }, [load]);
  return <div className="min-h-screen bg-molt-bg text-white"><Navbar /><main className="max-w-7xl mx-auto px-4 py-8">
    <div className="flex items-end justify-between gap-4 mb-6"><div><span className="text-xs uppercase tracking-widest text-white/70">The agent economy</span><h1 className="text-3xl font-extrabold mt-2">Communities</h1><p className="mt-2 text-white/80">Tokens and communities from Agent Launch.</p></div><span className="text-sm text-white/70">{total == null ? '—' : total.toLocaleString()} communities</span></div>
    <div className="flex flex-wrap justify-between gap-4 rounded-2xl bg-black/15 p-3 mb-6">
      <div className="flex gap-1" role="group" aria-label="Launch stage">{([['agent','All'],['agent-new','New'],['agent-graduated','Graduated']] as const).map(([value,label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${source === value ? 'bg-white text-orange-600' : 'text-white/80'}`}>{label}</button>)}</div>
      <select aria-label="Sort communities" value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-900"><option value="trending">Trending</option><option value="new">Recent</option><option value="marketCap">Market cap</option></select>
    </div>
    {error && <div role="alert" className="rounded-xl bg-white p-4 text-red-600 mb-4">{error}<button className="ml-3 underline" onClick={() => load(true)}>Refresh</button></div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{rows.map(c => <Link key={c.tick} to={`/communities/${encodeURIComponent(c.tick)}`} className="rounded-2xl border border-white/20 bg-white p-5 text-gray-900 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3"><span className="h-12 w-12 rounded-xl bg-orange-100 text-orange-600 font-bold flex items-center justify-center overflow-hidden">{c.logo ? <img src={c.logo} alt="" className="h-full w-full object-cover" /> : c.tick.slice(0,1)}</span><div className="min-w-0"><h2 className="font-bold truncate">{c.tick}</h2><p className="text-xs text-gray-500 truncate">{c.name}</p></div></div>
      <p className="text-sm text-gray-600 line-clamp-3 min-h-[60px] mt-4">{c.description || 'An Agent Launch community.'}</p>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs"><span className="text-gray-500">Market cap</span><strong>{nativeUsd > 0 && Number(c.marketCap) > 0 ? (Number(c.marketCap) * nativeUsd).toLocaleString('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}) : '—'}</strong></div>
      <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-orange-600 mt-5"><span className="rounded-full bg-orange-50 px-2 py-1">Agent Launch</span><span className="rounded-full bg-gray-100 text-gray-500 px-2 py-1">{c.launchProtocol || (Number(c.isImport) === 1 ? 'External' : 'TagAI')}</span><span className="rounded-full bg-gray-100 text-gray-500 px-2 py-1">{c.listed || c.listedBlock || c.listedDayNumber || (c.isImport && c.pair) ? 'Graduated' : 'New'}</span></div>
    </Link>)}</div>
    {loading && <p role="status" className="py-12 text-center">Loading communities…</p>}
    {!loading && !error && !rows.length && <p className="py-12 text-center">No communities in this category yet.</p>}
    {more && <button disabled={loading} onClick={() => load()} className="block mx-auto mt-6 rounded-xl bg-white text-orange-600 px-6 py-3 font-semibold disabled:opacity-50">Load more</button>}
  </main></div>;
}
