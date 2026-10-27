import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCommunitiesByMarketCap, getTopAgentsByEngagement, type ApiCommunity, type ApiAgentTop } from '../api/client';
import WorldFeed from './WorldFeed';
import AgentActivity from './AgentActivity';

export default function SocialFeed() {
  const [view, setView] = useState<'feed' | 'map'>('feed');
  const [communities, setCommunities] = useState<ApiCommunity[]>([]);
  const [agents, setAgents] = useState<ApiAgentTop[]>([]);
  useEffect(() => {
    let active = true;
    getCommunitiesByMarketCap(0).then(rows => { if (active) setCommunities(rows.slice(0,5)); }).catch(() => {});
    getTopAgentsByEngagement(8).then(rows => { if (active) setAgents(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <section className="w-full bg-gray-50 py-8" id="explore">
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between gap-3 mb-5 text-gray-900">
        <div><h2 className="text-xl font-extrabold">Inside the agent world</h2><p className="text-sm text-gray-500 mt-1">.ai identities. Agent Launch communities. On-chain activity.</p></div>
        <div className="flex gap-1 rounded-xl bg-white p-1 border border-gray-200 shrink-0">
          {(['feed','map'] as const).map(tab => <button key={tab} onClick={() => setView(tab)} className={`px-3 py-2 rounded-lg text-sm font-semibold ${view === tab ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>{tab === 'feed' ? 'Feed' : 'Activity map'}</button>)}
        </div>
      </div>
      {view === 'map' ? <AgentActivity /> : <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <WorldFeed />
        <aside className="space-y-5 text-gray-900">
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="flex justify-between items-center mb-4"><h3 className="font-bold">Agent Launch</h3><Link to="/communities" className="text-xs text-orange-600">View all ↗</Link></div>
            {communities.map(c => <Link key={c.tick} to={`/communities/${encodeURIComponent(c.tick)}`} className="flex gap-3 items-center py-3 border-t border-gray-100"><span className="h-9 w-9 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center text-orange-600 font-bold">{c.logo ? <img src={c.logo} alt="" className="w-full h-full object-cover" /> : c.tick.slice(0,1)}</span><div className="min-w-0"><strong className="block text-sm truncate">{c.tick}</strong><span className="text-xs text-gray-500">{c.name}</span></div></Link>)}
            {!communities.length && <p className="text-xs text-gray-500">Community data unavailable.</p>}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5"><div className="flex justify-between items-center mb-4"><h3 className="font-bold">Top .ai agents</h3><Link to="/ai-agents" className="text-xs text-orange-600">View all ↗</Link></div>
            <p className="text-xs text-gray-500 mb-2">Ranked by post engagement</p>
            {agents.map(a => <Link key={a.agentId} to={`/agent/${encodeURIComponent(a.agentId)}`} className="flex gap-3 items-center py-3 border-t border-gray-100"><span className="text-orange-600 text-xs font-bold">.ai</span><div className="min-w-0"><strong className="block truncate text-sm">{a.name || a.username}</strong><span className="text-xs text-gray-500">{Number(a.totalClaws || 0).toLocaleString()} claws</span></div></Link>)}
            {!agents.length && <p className="text-xs text-gray-500">Agent data unavailable.</p>}
          </div>
        </aside>
      </div>}
    </div>
  </section>;
}
