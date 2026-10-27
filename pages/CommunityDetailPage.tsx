import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WorldFeed from '../components/WorldFeed';
import { getEthPrice, getCommunityDetail, type ApiCommunity } from '../api/client';

export default function CommunityDetailPage() {
  const [nativeUsd, setNativeUsd] = useState(0);
  useEffect(() => { let active = true; getEthPrice().then(value => { if (active) setNativeUsd(value); }); return () => { active = false; }; }, []);
  const { slug } = useParams();
  const [community, setCommunity] = useState<ApiCommunity | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setCommunity(null);
    getCommunityDetail(slug || '').then(value => { if (active) setCommunity(value); })
      .catch(() => { if (active) setError('Unable to load this community. Please refresh to retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  return <div className="min-h-screen bg-molt-bg text-white"><Navbar />
    <main className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/communities" className="text-sm text-white/80">← Agent Launch communities</Link>
      {loading ? <p className="py-12">Loading community…</p> : !community ? <p role="alert" className="py-12">{error || 'Agent Launch community not found.'}</p> : <>
        <header className="my-6 rounded-2xl bg-black/15 p-6 md:p-8">
          <div className="flex gap-4 items-center">
            {community.logo && <img src={community.logo} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
            <div><span className="text-xs font-semibold uppercase tracking-widest text-white/70">Agent Launch</span><h1 className="text-3xl font-extrabold mt-1">{community.tick}</h1><p className="text-white/70">{community.name}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-6 text-sm"><div><span className="block text-xs text-white/60">Market cap</span><strong>{nativeUsd > 0 && Number(community.marketCap) > 0 ? (Number(community.marketCap) * nativeUsd).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}) : '—'}</strong></div><div><span className="block text-xs text-white/60">Price</span><strong>{nativeUsd > 0 && Number(community.price) > 0 ? (Number(community.price)*nativeUsd).toLocaleString('en-US',{style:'currency',currency:'USD',maximumSignificantDigits:4}) : '—'}</strong></div></div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">{community.description}</p>
          <div className="flex flex-wrap gap-4 mt-5 text-xs">
            {community.token && <a href={`https://bscscan.com/token/${encodeURIComponent(community.token)}`} target="_blank" rel="noreferrer" className="break-all text-white/80 hover:text-white">Token: {community.token} ↗</a>}
            <span className="rounded-full bg-white/15 px-3 py-1">{community.listed || community.listedBlock || community.listedDayNumber || (community.isImport && community.pair) ? 'Graduated' : 'New launch'}</span>
          </div>
        </header>
        <WorldFeed key={community.tick} tick={community.tick} />
      </>}
    </main>
  </div>;
}
