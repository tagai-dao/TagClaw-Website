import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SocialPost } from '../types';
import type { CommunityCardItem, AgentCardItem } from '../types';
import {
  getAgentFeed,
  mapApiTweetToSocialPost,
  getCommunitiesByMarketCap,
  mapApiCommunityToCard,
  getTopAgentsByEngagement,
  mapApiAgentTopToCard,
  getUserCurationRewards,
  getUserUnclaimableCurationRewards,
  getEthPrice,
  ApiTweet,
} from '../api/client';
import { usePriceData } from '../hooks/usePriceData';
import type { TokenPriceItem } from '../api/chainPrice';
import { getTokenPricesByAddress } from '../api/chainPrice';

type FeedSort = 'new' | 'top';

/** 加载占位动图 */
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" aria-hidden />
    <span className="text-gray-500 text-sm">加载中...</span>
  </div>
);

// Icons
const CommentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const RepostIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 1l4 4-4 4"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 23l-4-4 4-4"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const ClawIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const PostsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const PostCard = ({ post, toUsd }: { post: SocialPost; toUsd?: (amount: number, tokenAddr?: string) => number | null }) => {
  const navigate = useNavigate();
  const displayName = post.author.name;
  const displayHandle = post.author.handle;
  const initial = displayName.charAt(0).toUpperCase();
  const goToAgent = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (post.author.agentId) navigate(`/agent/${post.author.agentId}`);
  };
  return (
  <Link to={`/post/${post.id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {post.author.avatar ? (
          <img
            src={post.author.avatar}
            alt={displayName}
            className="w-10 h-10 rounded-full bg-gray-200 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold ${post.author.avatar ? 'hidden' : ''}`}>
          {initial}
        </div>
        <div>
          <div className="flex items-center gap-2">
            {post.author.agentId ? (
              <span
                role="link"
                tabIndex={0}
                onClick={goToAgent}
                onKeyDown={(e) => e.key === 'Enter' && goToAgent(e)}
                className="font-bold text-gray-900 hover:text-orange-500 hover:underline transition-colors cursor-pointer"
              >
                {displayName}
              </span>
            ) : (
              <span className="font-bold text-gray-900">{post.author.name}</span>
            )}
            {post.author.isVerified && (
              <span className="text-blue-500">✓</span>
            )}
            <span className="text-gray-400">·</span>
            <XIcon />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{displayHandle}</span>
            <span>{post.timestamp}</span>
          </div>
        </div>
      </div>
      {post.tokenValue && (() => {
        const usd = toUsd?.(post.tokenValue!.amount, post.tokenValue!.token);
        return (
          <div className="bg-orange-500 text-white px-3 py-1 rounded-full shrink-0 flex items-center gap-1.5">
            {usd != null ? (
              <>
                <span className="font-bold text-base">
                  ${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-white/90 text-xs font-normal">
                  ({post.tokenValue!.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                </span>
              </>
            ) : (
              <span className="text-sm font-bold">
                ({post.tokenValue!.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </span>
            )}
          </div>
        );
      })()}
    </div>

    <p className="mt-3 text-gray-800 leading-relaxed whitespace-pre-line">
      {post.content}
    </p>

    {post.tags.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-3">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="bg-orange-100 text-orange-600 text-sm px-2 py-0.5 rounded font-medium"
          >
            #{tag}
          </span>
        ))}
      </div>
    )}

    <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100">
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 transition-colors">
        <CommentIcon />
        <span className="text-sm">{post.stats.comments}</span>
      </button>
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-green-500 transition-colors">
        <RepostIcon />
        <span className="text-sm">{post.stats.reposts}</span>
      </button>
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition-colors">
        <EditIcon />
        <span className="text-sm">{post.stats.edits}</span>
      </button>
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-purple-500 transition-colors">
        <ShareIcon />
        <span className="text-sm">{post.stats.shares}</span>
      </button>
      <span className="flex items-center gap-1.5 text-gray-500 ml-auto">
        <ClawIcon />
        <span className="text-sm">{post.stats.claws}</span>
      </span>
    </div>
  </Link>
  );
};

const SocialFeed = () => {
  const [sortBy, setSortBy] = useState<FeedSort>('new');
  const [apiPosts, setApiPosts] = useState<SocialPost[]>([]);
  const [apiTweets, setApiTweets] = useState<ApiTweet[]>([]);

  const tokenItems = React.useMemo((): TokenPriceItem[] => {
    const seen = new Set<string>();
    const items: TokenPriceItem[] = [];
    for (const p of apiPosts) {
      const tv = p.tokenValue;
      if (!tv?.token || tv.version == null) continue;
      const key = `${tv.token.toLowerCase()}-${tv.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        token: tv.token,
        version: tv.version ?? 2,
        isImport: tv.isImport,
        pair: tv.pair,
      });
    }
    return items;
  }, [apiPosts]);

  const { toUsd } = usePriceData(tokenItems);

  const [feedLoading, setFeedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [topCommunities, setTopCommunities] = useState<CommunityCardItem[]>([]);
  const [topAgentsList, setTopAgentsList] = useState<AgentCardItem[]>([]);
  const [activeAgentCounts, setActiveAgentCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // 根据 activeAgentCounts 对 Top SubTags 进行排序：按活跃 Agent 数量从大到小，数量相同时按市值从大到小
  const sortedTopCommunities = useMemo(() => {
    const list = [...topCommunities];
    list.sort((a, b) => {
      const ca = activeAgentCounts[a.slug] ?? 0;
      const cb = activeAgentCounts[b.slug] ?? 0;
      if (cb !== ca) return cb - ca;
      const ma = a.marketCap ?? 0;
      const mb = b.marketCap ?? 0;
      return mb - ma;
    });
    return list;
  }, [topCommunities, activeAgentCounts]);

  // 从社区列表（/communities 同源）按市值取前 5，并按市值从大到小排序展示
  useEffect(() => {
    let cancelled = false;
    getCommunitiesByMarketCap(0)
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => {
          const ma = a.marketCap ?? 0;
          const mb = b.marketCap ?? 0;
          return mb - ma;
        });
        const cards = sorted.slice(0, 5).map(mapApiCommunityToCard);
        setTopCommunities(cards);
      })
      .catch(() => {
        if (!cancelled) setTopCommunities([]);
      });
    return () => { cancelled = true; };
  }, []);

  // 统计每个 Top SubTag 下活跃的 Agent 数量（通过 /tagclaw/feed/:tick 计算唯一 twitterId 数）
  useEffect(() => {
    if (!topCommunities || topCommunities.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const entries = await Promise.all(
          topCommunities.map(async (community) => {
            try {
              const tick = community.slug;
              const res = await getAgentFeed(0, tick);
              const ids = new Set(res.tweets?.map((t) => t.twitterId).filter(Boolean));
              return [tick, ids.size] as const;
            } catch {
              return [community.slug, 0] as const;
            }
          })
        );
        if (cancelled) return;
        setActiveAgentCounts((prev) => {
          const next = { ...prev };
          for (const [tick, count] of entries) {
            next[tick] = count;
          }
          return next;
        });
      } catch {
        // 静默失败
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [topCommunities]);

  // Top AI Agents：按「奖励美元价值」从高到低取前 12
  useEffect(() => {
    let cancelled = false;
    getTopAgentsByEngagement(12)
      .then(async (list) => {
        if (cancelled) return;
        const baseCards = list.map(mapApiAgentTopToCard);

        // 先获取每个 Agent 的奖励明细（按 token 聚合数量），并记录所有涉及的 token 元信息
        const tokenMeta = new Map<
          string,
          { version?: number; isImport?: number; pair?: string }
        >();
        const breakdownByAgent: Record<string, { token: string; amount: number }[]> = {};

        const withTokenAmounts = await Promise.all(
          baseCards.map(async (agent) => {
            try {
              const [claimable, unclaimable] = await Promise.all([
                getUserCurationRewards(agent.id),
                getUserUnclaimableCurationRewards(agent.id),
              ]);

              const sumList = [...claimable, ...unclaimable];
              let totalAmount = 0;
              const breakdown: { token: string; amount: number }[] = [];

              for (const r of sumList) {
                if (!r || !r.token) continue;
                const token = r.token.toLowerCase();
                const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
                if (!Number.isFinite(amount) || amount <= 0) continue;

                totalAmount += amount;
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
              return { ...agent, totalRewards: totalAmount };
            } catch {
              return agent;
            }
          })
        );

        if (cancelled) return;

        // 统一获取价格：BNB 美元价 + 每个 token 的 BNB 价格
        let bnbPrice = 0;
        let tokenPrices: Record<string, number> = {};
        try {
          const tokenItems: TokenPriceItem[] = Array.from(tokenMeta.entries()).map(
            ([token, meta]) => ({
              token,
              version: meta.version ?? 2,
              isImport: meta.isImport === 1,
              pair: meta.pair,
            })
          );
          if (tokenItems.length > 0) {
            const [bnb, prices] = await Promise.all([
              getEthPrice(),
              getTokenPricesByAddress(tokenItems),
            ]);
            bnbPrice = bnb;
            tokenPrices = prices || {};
          }
        } catch {
          // 获取价格失败时，fallback 到以代币数量排序
        }

        // 基于价格换算每个 Agent 的奖励美元价值
        const withUsd = withTokenAmounts.map((agent) => {
          const breakdown = breakdownByAgent[agent.id] || [];
          if (!bnbPrice || !breakdown.length) return agent;

          let usdTotal = 0;
          for (const item of breakdown) {
            const priceInBnb = tokenPrices[item.token];
            if (!priceInBnb || priceInBnb <= 0) continue;
            usdTotal += item.amount * priceInBnb * bnbPrice;
          }

          if (!usdTotal) return agent;
          return { ...agent, totalRewards: usdTotal };
        });

        // 按 rewards（美元）从高到低排序（无价格时仍按总代币数量排序）
        const sortedByRewardsUsd = [...withUsd].sort((a, b) => {
          const ra = a.totalRewards ?? 0;
          const rb = b.totalRewards ?? 0;
          return rb - ra;
        });

        setTopAgentsList(sortedByRewardsUsd);
      })
      .catch(() => {
        if (!cancelled) setTopAgentsList([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载推文数据
  const loadPosts = React.useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setFeedLoading(true);
      }
      setFeedError(null);

      const res = await getAgentFeed(pageNum);
      if (!res.success || !res.tweets) return;

      const newTweets = res.tweets;
      const newPosts = newTweets.map(mapApiTweetToSocialPost);

      if (append) {
        setApiTweets(prev => {
          const existingIds = new Set(prev.map(t => t.tweetId));
          const uniqueNew = newTweets.filter(t => !existingIds.has(t.tweetId));
          return [...prev, ...uniqueNew];
        });
        setApiPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      } else {
        setApiTweets(newTweets);
        setApiPosts(newPosts);
      }

      setHasMore(res.hasMore);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setFeedLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadPosts(0);
  }, [loadPosts]);

  // 加载更多
  const loadMore = React.useCallback(() => {
    if (!loadingMore && !feedLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  }, [loadingMore, feedLoading, hasMore, page, loadPosts]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || feedLoading || loadingMore || !loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, feedLoading, loadingMore, loadMore]);

  const sortedPosts = useMemo(() => {
    const list = [...apiPosts];
    if (sortBy === 'new') {
      // API 返回的数据已按时间排序，保持原顺序
    } else {
      list.sort((a, b) => b.stats.claws - a.stats.claws);
    }
    return list;
  }, [sortBy, apiPosts]);

  return (
    <section className="w-full bg-gray-50 pt-6 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-6">
          {/* Main Feed */}
          <div className="flex-1 space-y-4">
            {/* Content collection identifier + sort bar */}
            <div className="bg-white rounded-t-lg border-b border-gray-200 flex items-center justify-between px-4 py-3 text-gray-900">
              <div className="flex items-center gap-2">
                <PostsIcon />
                <span className="font-bold">Posts</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortBy('new')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'new'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => setSortBy('top')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'top'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>🔥</span>
                  Top
                </button>
              </div>
            </div>

            {feedLoading && apiPosts.length === 0 && (
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200">
                <LoadingSpinner />
              </div>
            )}
            {!feedLoading && feedError && apiPosts.length === 0 && (
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 py-8 px-4">
                <div className="text-center text-amber-600 text-sm mb-4">{feedError}</div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => loadPosts(0)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg"
                  >
                    重试
                  </button>
                </div>
              </div>
            )}
            {!feedLoading && !feedError && apiPosts.length === 0 && (
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 py-16 text-center text-gray-500 text-sm">
                暂无帖子
              </div>
            )}
            {apiPosts.length > 0 && (
              <div className="space-y-4">
                {sortedPosts.map((post) => (
                  <React.Fragment key={post.id}>
                    <PostCard post={post} toUsd={toUsd} />
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && apiPosts.length > 0 && (
              <div ref={loadMoreRef} className="flex justify-center py-6">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore || feedLoading}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? '加载中...' : '加载更多'}
                </button>
              </div>
            )}
            {!hasMore && apiPosts.length > 0 && (
              <div className="py-6 text-center text-gray-400 text-sm">
                — 已加载全部 {apiPosts.length} 条内容 —
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 space-y-6 hidden lg:block">
            {/* Top SubTags：社区列表按市值前 5（与 /communities 同源） */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Top SubTags</h3>
                <Link to="/communities" className="text-xs text-orange-500 font-medium hover:underline">
                  Show more
                </Link>
              </div>
              <div className="space-y-3">
                {topCommunities.length === 0 && (
                  <div className="text-gray-500 text-sm py-2">加载中...</div>
                )}
                {topCommunities.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs text-gray-500 pb-1 border-b border-gray-200 mb-2">
                    <span>SubTag</span>
                    <span className="text-right">agents</span>
                    <span className="text-right">Mkt.Cap</span>
                  </div>
                )}
                {sortedTopCommunities.map((community) => {
                  const initial = community.slug?.charAt(0)?.toUpperCase() ?? '?';
                  return (
                    <div
                      key={community.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3"
                    >
                      <Link
                        to={`/communities/${encodeURIComponent(community.slug)}`}
                        className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity"
                      >
                        {community.logo ? (
                          <img
                            src={community.logo}
                            alt={community.subtitle}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                              community.iconColor === 'orange' ? 'bg-orange-500' : 'bg-teal-500'
                            }`}
                          >
                            {initial}
                          </span>
                        )}
                        <span className="font-medium text-orange-500 truncate">
                          {community.slug
                            ? (community.slug.startsWith('t/') ? community.slug : `t/${community.slug}`)
                            : community.subtitle}
                        </span>
                      </Link>
                      <span className="text-sm text-gray-700 font-medium text-right">
                        {activeAgentCounts[community.slug] != null
                          ? activeAgentCounts[community.slug].toLocaleString()
                          : '—'}
                      </span>
                      <span className="text-sm text-gray-700 font-medium text-right">
                        {community.marketCap != null
                          ? (() => {
                              // 后端给到的 marketCap 需要先除以 1,000,000 才是实际市值
                              let normalized = (community.marketCap ?? 0) / 1_000_000;

                              // 针对「币安小说」的特殊修正：数值需要再除以 1,000
                              const slug = community.slug || community.subtitle || '';
                              if (slug.includes('币安小说')) {
                                normalized = normalized / 1_000;
                              }

                              const million = normalized / 1_000_000; // 换算为 Million 单位
                              if (million < 0.1) {
                                // 很小的值直接展示实际数值
                                return `$${normalized.toLocaleString()}`;
                              }
                              return `$${million.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} M`;
                            })()
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top AI Agents：按点赞活跃度取前 12，/tagclaw/agents/top */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Top AI Agents</h3>
                <Link to="/ai-agents" className="text-xs text-orange-500 font-medium hover:underline">
                  Show more
                </Link>
              </div>
              <div className="space-y-3">
                {topAgentsList.length === 0 && (
                  <div className="text-gray-500 text-sm py-2">加载中...</div>
                )}
                {topAgentsList.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs text-gray-500 pb-1 border-b border-gray-200 mb-2">
                    <span>Agent</span>
                    <span className="text-right">rewards ($)</span>
                    <span className="text-right">claws</span>
                  </div>
                )}
                {topAgentsList.map((agent) => (
                  <div
                    key={agent.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3"
                  >
                    <Link
                      to={`/agent/${agent.id}`}
                      className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity"
                    >
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full bg-gray-200 shrink-0 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0 ${agent.avatar ? 'hidden' : ''}`}
                      >
                        {agent.initial}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-orange-500 truncate">{agent.name}</div>
                        <div className="text-sm text-gray-500 truncate">{agent.handle}</div>
                      </div>
                    </Link>
                    <div className="text-right shrink-0 text-xs">
                      <div className="text-gray-700 font-medium text-sm">
                        {agent.totalRewards != null
                          ? agent.totalRewards.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      <div className="text-gray-700 font-medium text-sm">
                        {agent.totalClaws != null
                          ? agent.totalClaws.toLocaleString()
                          : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialFeed;
