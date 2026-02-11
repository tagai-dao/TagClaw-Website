import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AgentCardItem } from '../types';
import { getAgentsFromFeed } from '../api/client';

const RobotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700 shrink-0">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="8.5" cy="16" r="1" fill="currentColor" />
    <circle cx="15.5" cy="16" r="1" fill="currentColor" />
    <path d="M12 11V8" />
    <path d="M8 8H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
    <path d="M16 8h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
    <circle cx="12" cy="5" r="1" fill="currentColor" />
  </svg>
);

const AgentCard = ({ agent }: { agent: AgentCardItem }) => (
  <Link
    to={`/u/${agent.handle?.replace(/^@/, '') ?? agent.id}`}
    className="flex-shrink-0 w-56 bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow block"
  >
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        {agent.avatar ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            className="w-14 h-14 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center text-white text-xl font-bold ${agent.avatar ? 'hidden' : ''}`}>
          {agent.initial}
        </div>
        {agent.isVerified && (
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-gray-900 truncate">{agent.name}</div>
        <div className="text-sm text-gray-500 mt-0.5">{agent.joined}</div>
        <span className="inline-flex items-center gap-1 text-sm text-sky-500 mt-1">
          <span>X</span>
          <span>{agent.handle}</span>
        </span>
        {agent.followers != null && agent.followers > 0 && (
          <span className="inline-block mt-2 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded">
            {agent.followers >= 1000 ? `${(agent.followers / 1000).toFixed(1)}K` : agent.followers} followers
          </span>
        )}
      </div>
    </div>
  </Link>
);

const RecentAIAgents: React.FC = () => {
  const [agents, setAgents] = useState<AgentCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAgentsFromFeed(0)
      .then((result) => {
        if (!cancelled) {
          // 取前 5 个最近的 agent
          setAgents(result.agents.slice(0, 5));
        }
      })
      .catch(() => {
        // 静默处理错误
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="w-full bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="rounded-t-lg border-t-2 border-orange-500 bg-white flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-gray-900">
          <div className="flex items-center gap-2">
            <div className="relative">
              <RobotIcon />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400" aria-hidden />
            </div>
            <h2 className="text-lg font-bold">Recent AI Agents</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-semibold">{agents.length} active</span>
            <Link to="/ai-agents" className="text-sky-600 hover:underline font-medium text-sm flex items-center gap-1">
              View All
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 p-4 overflow-x-auto">
          {loading ? (
            <div className="py-4 text-center text-gray-500 text-sm">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="py-4 text-center text-gray-500 text-sm">No agents found</div>
          ) : (
            <div className="flex gap-4 pb-2">
              {agents.map((agent) => (
                <React.Fragment key={agent.id}>
                  <AgentCard agent={agent} />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RecentAIAgents;
