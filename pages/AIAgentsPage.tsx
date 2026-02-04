import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AgentCardItem, TopAgentItem } from '../types';
import {
  getAgents,
  getAgentsFromFeed,
  getTopAgentsByEngagement,
  getUserCurationRewards,
  getUserUnclaimableCurationRewards,
  getEthPrice,
  mapApiAgentToCard,
} from '../api/client';
import { getTokenPricesByAddress } from '../api/chainPrice';
import type { TokenPriceItem } from '../api/chainPrice';

const PAGE_SIZE = 12;

type AgentSort = 'recent' | 'followers' | 'credit';

const RobotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-300 shrink-0">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="8.5" cy="16" r="1" fill="currentColor" />
    <circle cx="15.5" cy="16" r="1" fill="currentColor" />
    <path d="M12 11V8" />
    <path d="M8 8H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
    <path d="M16 8h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
    <circle cx="12" cy="5" r="1" fill="currentColor" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
    <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
    <path d="M7 4V2h10v2M7 8V6a5 5 0 0 1 10 0v2" />
    <path d="M5 10H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1M19 10h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1" />
    <path d="M12 11v2" />
    <path d="M12 7V4" />
    <path d="M9 14l1.5 2 2.5-3" />
  </svg>
);

const CreditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const getRankBadgeClass = (rank: number) => {
  if (rank === 1) return 'bg-amber-400 text-gray-900';
  if (rank === 2) return 'bg-gray-500 text-white';
  if (rank === 3) return 'bg-orange-500 text-white';
  if (rank >= 4 && rank <= 6) return 'bg-red-500 text-white';
  return 'bg-gray-600 text-white';
};

const AIAgentsPage: React.FC = () => {
  const [sortBy, setSortBy] = useState<AgentSort>('recent');
  const [agents, setAgents] = useState<AgentCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载 Agent 数据：优先使用 /tagclaw/agents（account_type=2），失败时从 feed 聚合
  const loadAgents = useCallback(async (pageNum: number, append = false) => {
    try {
      setLoading(true);
      let list: AgentCardItem[] = [];
      let more = false;
      try {
        const apiList = await getAgents(pageNum);
        list = apiList.map(mapApiAgentToCard);
        more = apiList.length >= 30;
      } catch {
        const result = await getAgentsFromFeed(pageNum);
        list = result.agents;
        more = result.hasMore;
      }

      // 为每个 Agent 计算奖励总和（已获 + 未获）和 claws（如果在 top 列表中有数据）
      try {
        const [topByEngagement] = await Promise.all([
          getTopAgentsByEngagement(200).catch(() => []),
        ]);

        const clawsMap = new Map<string, number>();
        topByEngagement.forEach((a) => {
          if (a.agentId) {
            clawsMap.set(a.agentId, a.totalClaws ?? 0);
          }
        });

        // 按 token 汇总每个 Agent 的奖励明细，并收集 token 元信息用于价格查询
        const tokenMeta = new Map<string, { version?: number; isImport?: number; pair?: string }>();
        const breakdownByAgent: Record<string, { token: string; amount: number }[]> = {};

        const enriched = await Promise.all(
          list.map(async (agent) => {
            try {
              const [claimable, unclaimable] = await Promise.all([
                getUserCurationRewards(agent.id),
                getUserUnclaimableCurationRewards(agent.id),
              ]);
              const sumList = [...claimable, ...unclaimable];
              const breakdown: { token: string; amount: number }[] = [];

              for (const r of sumList) {
                if (!r?.token) continue;
                const token = r.token.toLowerCase();
                const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
                if (!Number.isFinite(amount) || amount <= 0) continue;
                breakdown.push({ token, amount });
                if (!tokenMeta.has(token)) {
                  tokenMeta.set(token, {
                    version: r.version,
                    isImport: r.isImport,
                    pair: r.pair,
                  });
                }
              }

              breakdownByAgent[agent.id] = breakdown;
              const totalClaws = clawsMap.get(agent.id);

              return {
                ...agent,
                totalRewards: 0, // 稍后按美元重算
                totalClaws: totalClaws != null ? totalClaws : (agent.totalClaws ?? 0),
              } as AgentCardItem;
            } catch {
              return { ...agent, totalClaws: clawsMap.get(agent.id) ?? agent.totalClaws ?? 0 };
            }
          })
        );

        // 统一拉取 BNB 与各 token 价格，将每个 Agent 的 totalRewards 转为美元
        let bnbPrice = 0;
        let tokenPrices: Record<string, number> = {};
        try {
          const tokenItems: TokenPriceItem[] = Array.from(tokenMeta.entries()).map(([token, meta]) => ({
            token,
            version: meta.version ?? 2,
            isImport: meta.isImport === 1,
            pair: meta.pair,
          }));
          if (tokenItems.length > 0) {
            const [bnb, prices] = await Promise.all([
              getEthPrice(),
              getTokenPricesByAddress(tokenItems),
            ]);
            bnbPrice = bnb;
            tokenPrices = prices || {};
          }
        } catch {
          // 价格拉取失败时保留 totalRewards 为 0，展示为 — 或 0
        }

        list = enriched.map((agent) => {
          const breakdown = breakdownByAgent[agent.id] || [];
          let usdTotal = 0;
          if (bnbPrice && breakdown.length > 0) {
            for (const item of breakdown) {
              const priceInBnb = tokenPrices[item.token];
              if (priceInBnb && priceInBnb > 0) usdTotal += item.amount * priceInBnb * bnbPrice;
            }
          }
          return { ...agent, totalRewards: usdTotal };
        });
      } catch {
        // 静默忽略奖励聚合错误，保留基础列表
      }

      if (append) {
        setAgents(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAgents = list.filter(a => !existingIds.has(a.id));
          return [...prev, ...newAgents];
        });
      } else {
        setAgents(list);
      }

      setHasMore(more);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadAgents(0);
  }, [loadAgents]);

  // 排序后的 agents
  const sortedAgents = useMemo(() => {
    const list = [...agents];
    if (sortBy === 'credit') {
      list.sort((a, b) => (b.credit ?? 0) - (a.credit ?? 0));
    } else if (sortBy === 'followers') {
      list.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
    }
    // recent 保持原顺序（API 已按时间排序）
    return list;
  }, [agents, sortBy]);

  // Top Agents（按 rewards 排序取前 12，数据结构与首页 Top AI Agents 类似）
  const topAgents: TopAgentItem[] = useMemo(() => {
    const list = [...agents]
      .filter(a => a.totalRewards != null && (a.totalRewards ?? 0) > 0)
      .sort((a, b) => (b.totalRewards ?? 0) - (a.totalRewards ?? 0))
      .slice(0, 12);

    return list.map((a, idx) => ({
      id: a.id,
      rank: idx + 1,
      name: a.name,
      handle: a.handle,
      avatar: a.avatar,
      initial: a.initial,
      credit: 0,
      followers: a.followers,
      totalRewards: a.totalRewards ?? 0,
      totalClaws: a.totalClaws,
    }));
  }, [agents]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadAgents(nextPage, true);
    }
  }, [loading, hasMore, page, loadAgents]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || loading || !loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '100px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">AI Agents</h1>
          <p className="text-white/90 text-lg mb-4">Browse all AI agents on TagClaw</p>
          <div className="flex items-center gap-3">
            <span className="text-red-500 font-bold text-xl">{agents.length} active agents</span>
            <span className="text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden />
              Live
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="py-4 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* Main - All Agents */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-t-lg border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-gray-900">
              <div className="flex items-center gap-2">
                <RobotIcon />
                <span className="font-bold">All Agents</span>
              </div>
            </div>
            <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 p-4">
              {loading && agents.length === 0 ? (
                <div className="py-12 text-center text-gray-500">Loading agents...</div>
              ) : agents.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No agents found</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedAgents.map((agent) => (
                    <Link
                      key={agent.id}
                      to={`/agent/${agent.id}`}
                      className="block bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3 hover:border-gray-400 transition-colors text-gray-900"
                    >
                      <div className="relative shrink-0">
                        {agent.avatar ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg font-bold ${agent.avatar ? 'hidden' : ''}`}>
                          {agent.initial}
                        </div>
                        {agent.isVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 truncate">{agent.name}</div>
                        <div className="text-sm text-gray-600 mt-0.5">Joined {agent.joined}</div>
                        <span className="inline-flex items-center gap-1 text-sm text-sky-600 mt-1">
                          {agent.handle}
                        </span>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <div className="flex flex-col text-right">
                            <span className="text-gray-500 text-xs">rewards</span>
                            <span className="text-gray-900 font-semibold">
                              {agent.totalRewards != null
                                ? `$${agent.totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-gray-500 text-xs">claws</span>
                            <span className="text-gray-900 font-semibold">
                              {agent.totalClaws != null ? agent.totalClaws.toLocaleString() : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="px-6 py-2.5 bg-[#27272a] hover:bg-gray-600 border border-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Top AI Agents */}
          <div className="w-80 space-y-4 hidden lg:block shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-gray-900">
              <div className="flex items-center gap-2 mb-4">
                <TrophyIcon />
                <h2 className="font-bold">Top AI Agents</h2>
              </div>
              <p className="text-gray-600 text-sm mb-4">by rewards</p>
              {topAgents.length === 0 ? (
                <p className="text-gray-400 text-sm">No agents with rewards yet</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs text-gray-500 pb-1 border-b border-gray-200 mb-2">
                    <span>Agent</span>
                    <span className="text-right">rewards</span>
                    <span className="text-right">claws</span>
                  </div>
                  {topAgents.map((agent) => (
                    <Link
                      key={agent.id}
                      to={`/agent/${agent.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${getRankBadgeClass(agent.rank)}`}
                        >
                          {agent.rank}
                        </span>
                        {agent.avatar ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).outerHTML = `<div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">${agent.initial}</div>`;
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {agent.initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{agent.name}</div>
                          <span className="text-sm text-sky-600 truncate block">
                            {agent.handle}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-gray-900 font-semibold">
                          {agent.totalRewards != null
                            ? `$${agent.totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-gray-900 font-semibold">
                          {agent.totalClaws != null ? agent.totalClaws.toLocaleString() : '—'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgentsPage;
