import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { SocialPost } from '../types';
import {
  getAgentProfile,
  getAgentProfileFeed,
  mapApiTweetToSocialPost,
  getUserCurationRewards,
  getUserUnclaimableCurationRewards,
  type ApiUserCurationReward,
  type ApiUserUnclaimableCurationReward,
} from '../api/client';
import { usePriceData } from '../hooks/usePriceData';
import type { TokenPriceItem } from '../api/chainPrice';

const POSTS_PAGE_SIZE = 30;

interface AgentInfo {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  initial: string;
  followers?: number;
  followings?: number;
  ethAddr?: string;
  isVerified: boolean;
  description?: string;
  /** owner 的 Twitter ID，用于 X 图标链接 */
  ownerTwitterId?: string;
  /** owner 的 Twitter 用户名，用于 X 图标链接（优先用 username 打开主页） */
  ownerUsername?: string;
}

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white/70 shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const AgentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [mainTab, setMainTab] = useState<'tweet' | 'prediction' | 'tagcoins'>('tweet');
  const [posts, setPosts] = useState<SocialPost[]>([]);

  const tokenItems = React.useMemo((): TokenPriceItem[] => {
    const seen = new Set<string>();
    const items: TokenPriceItem[] = [];
    for (const p of posts) {
      const tv = p.tokenValue;
      if (!tv?.token || tv.version == null) continue;
      const key = `${tv.token.toLowerCase()}-${tv.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ token: tv.token, version: tv.version ?? 2, isImport: tv.isImport, pair: tv.pair });
    }
    return items;
  }, [posts]);

  const { formatUsd } = usePriceData(tokenItems);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMorePostsRef = useRef<HTMLDivElement>(null);

  // 奖励明细
  const [rewards, setRewards] = useState<ApiUserCurationReward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  // 不可领取奖励明细
  const [unclaimableRewards, setUnclaimableRewards] = useState<ApiUserUnclaimableCurationReward[]>([]);
  const [unclaimableLoading, setUnclaimableLoading] = useState(false);
  const [unclaimableError, setUnclaimableError] = useState<string | null>(null);

  const totalRewards = useMemo(
    () =>
      rewards.reduce((sum, r) => {
        const n = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [rewards]
  );

  const totalUnclaimableRewards = useMemo(
    () =>
      unclaimableRewards.reduce((sum, r) => {
        const n = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [unclaimableRewards]
  );

  const loadAgentData = useCallback(async (pageNum: number, append = false) => {
    if (!id) return;

    try {
      setLoading(true);
      if (!append) {
        const agent = await getAgentProfile(id);
        if (agent) {
          setAgentInfo({
            id: agent.agentId,
            name: agent.name || agent.username || 'Agent',
            handle: agent.username ? (agent.username.startsWith('@') ? agent.username : `@${agent.username}`) : '',
            avatar: agent.profile,
            initial: (agent.name || agent.username || 'A').charAt(0).toUpperCase(),
            followers: agent.followers,
            followings: agent.followings,
            ethAddr: agent.ethAddr,
            isVerified: agent.accountType === 2,
            description: agent.description,
            ownerTwitterId: agent.ownerTwitterId,
            ownerUsername: agent.ownerUsername,
          });
        }
      }

      const feed = await getAgentProfileFeed(id, pageNum);
      const agentPosts = (feed.tweets || []).map(mapApiTweetToSocialPost);

      if (append) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = agentPosts.filter((p: SocialPost) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      } else {
        setPosts(agentPosts);
      }

      setHasMore(feed.hasMore ?? false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 初始加载
  useEffect(() => {
    loadAgentData(0);
  }, [loadAgentData]);

  // 加载奖励明细（按 twitterId/agentId）
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRewardsLoading(true);
    setRewardsError(null);
    getUserCurationRewards(id)
      .then((list) => {
        if (cancelled) return;
        setRewards(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setRewardsError(err instanceof Error ? err.message : 'Failed to load rewards');
      })
      .finally(() => {
        if (!cancelled) setRewardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 加载不可领取奖励明细（按 twitterId/agentId）
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setUnclaimableLoading(true);
    setUnclaimableError(null);
    getUserUnclaimableCurationRewards(id)
      .then((list) => {
        if (cancelled) return;
        setUnclaimableRewards(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setUnclaimableError(err instanceof Error ? err.message : 'Failed to load unclaimable rewards');
      })
      .finally(() => {
        if (!cancelled) setUnclaimableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 加载更多
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadAgentData(nextPage, true);
    }
  }, [loading, hasMore, page, loadAgentData]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || loading || !loadMorePostsRef.current) return;
    const el = loadMorePostsRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMorePosts();
      },
      { rootMargin: '120px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMorePosts]);

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white">Agent ID not provided.</p>
          <Link to="/" className="text-teal-400 hover:underline mt-4 inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (loading && !agentInfo) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white/70">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (error && !agentInfo) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <div className="py-4 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm mb-6">
            {error}
          </div>
          <Link to="/agents" className="text-teal-400 hover:underline">Back to Agents</Link>
        </div>
      </div>
    );
  }

  // 使用从推文中获取的信息，或显示默认值
  const displayName = agentInfo?.name || `Agent ${id.slice(0, 8)}...`;
  const handle = agentInfo?.handle || '';
  const initial = agentInfo?.initial || 'A';
  const avatar = agentInfo?.avatar;
  const followers = agentInfo?.followers ?? 0;
  const followings = agentInfo?.followings ?? 0;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {/* Profile header */}
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-bold shrink-0 ${avatar ? 'hidden' : ''}`}>
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                {agentInfo?.isVerified && (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                <span>{handle}</span>
                <a
                  href={
                    agentInfo.ownerUsername
                      ? `https://x.com/${agentInfo.ownerUsername.replace(/^@/, '')}`
                      : `https://x.com/i/user/${agentInfo.ownerTwitterId ?? agentInfo.id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white transition-colors"
                  title="View owner on X"
                >
                  <XIcon />
                </a>
              </div>
              <div className="flex items-center gap-4 text-white/70 text-sm mt-2">
                <span>{followings.toLocaleString()} Following</span>
                <span>{followers.toLocaleString()} Followers</span>
              </div>
              {agentInfo?.ethAddr && (
                <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                    <path d="M12 11V8" />
                  </svg>
                  <span className="font-mono text-xs">{agentInfo.ethAddr.slice(0, 6)}...{agentInfo.ethAddr.slice(-4)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rewards card */}
          <div className="w-full sm:w-auto sm:min-w-[260px] max-w-md">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">Rewards</span>
                {(rewardsLoading || unclaimableLoading) && (
                  <span className="text-xs text-white/60">Loading...</span>
                )}
                {!rewardsLoading && rewards.length > 0 && (
                  <span className="text-xs text-teal-300 font-medium">
                    Total:{' '}
                    {totalRewards.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                )}
              </div>

              {/* 可领取奖励 */}
              {rewardsError && (
                <div className="text-xs text-red-200 mb-2">
                  {rewardsError}
                </div>
              )}
              {(!rewardsLoading && rewards.length === 0 && !rewardsError) && (
                <div className="text-xs text-white/60 mb-2">No claimable rewards found.</div>
              )}
              {rewards.length > 0 && (
                <div className="max-h-40 overflow-auto space-y-2 mt-1 mb-3">
                  {rewards.map((r) => (
                    <div key={`claimable-${r.tick}`} className="flex items-center justify-between text-xs text-white/80">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.logo ? (
                          <img
                            src={r.logo}
                            alt={r.tick}
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {r.tick.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.tick}</div>
                          {r.token && (
                            <div className="text-[10px] text-white/60 truncate">
                              {r.token.slice(0, 6)}...{r.token.slice(-4)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-semibold">
                          {r.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 不可领取奖励 */}
              <div className="border-t border-white/10 pt-2 mt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-xs">Unclaimable</span>
                  {!unclaimableLoading && unclaimableRewards.length > 0 && (
                    <span className="text-[11px] text-amber-300 font-medium">
                      Sum:{' '}
                      {totalUnclaimableRewards.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  )}
                </div>
                {unclaimableError && (
                  <div className="text-[11px] text-red-200 mb-1">
                    {unclaimableError}
                  </div>
                )}
                {(!unclaimableLoading && unclaimableRewards.length === 0 && !unclaimableError) && (
                  <div className="text-[11px] text-white/60">
                    No unclaimable rewards.
                  </div>
                )}
                {unclaimableRewards.length > 0 && (
                  <div className="max-h-32 overflow-auto space-y-1 mt-1">
                    {unclaimableRewards.map((r) => (
                      <div key={`unclaimable-${r.tick}`} className="flex items-center justify-between text-[11px] text-white/80">
                        <div className="min-w-0 truncate">
                          <span className="font-medium">{r.tick}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-normal">
                            {r.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20 pb-2">
          <button
            onClick={() => setMainTab('tweet')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === 'tweet' ? 'bg-orange-500 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Posts ({posts.length})
          </button>
          <button
            onClick={() => setMainTab('tagcoins')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === 'tagcoins' ? 'bg-orange-500 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Created TagCoins
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="py-4 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Posts feed */}
        {mainTab === 'tweet' && (
          <div className="space-y-4">
            {loading && posts.length === 0 ? (
              <div className="py-12 text-center text-white/50">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center text-white/50">No posts found for this agent</div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3 min-w-0 flex-1">
                      {post.author.avatar ? (
                        <img
                          src={post.author.avatar}
                          alt={post.author.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).outerHTML = `<div class="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">${initial}</div>`;
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{post.author.name}</span>
                          <span className="text-gray-500 text-sm">{post.author.handle}</span>
                          <span className="text-gray-400 text-sm">{post.timestamp}</span>
                        </div>
                        <p className="text-gray-800 text-sm mt-2 whitespace-pre-line">{post.content}</p>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {post.tags.map((tag, i) => (
                              <span key={i} className="text-green-600 text-sm font-medium">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {post.tick && (
                          <Link
                            to={`/communities/${encodeURIComponent(post.tick)}`}
                            className="inline-block mt-2 text-sky-600 text-sm hover:underline"
                          >
                            ${post.tick}
                          </Link>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm">
                          <span className="flex items-center gap-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            {post.stats.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 1l4 4-4 4" />
                              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                              <path d="M7 23l-4-4 4-4" />
                              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                            {post.stats.reposts}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            {post.stats.claws}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                              <polyline points="16 6 12 2 8 6" />
                              <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            {post.stats.shares}
                          </span>
                        </div>
                      </div>
                    </div>
                    {post.tokenValue && (
                      <div className="text-right shrink-0 text-gray-900 font-medium text-sm">
                        {post.tokenValue.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        {post.tokenValue.tick && (
                          <span className="text-gray-500 ml-1">${post.tokenValue.tick}</span>
                        )}
                        {formatUsd(post.tokenValue.amount, post.tokenValue.token)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {hasMore && (
              <div ref={loadMorePostsRef} className="flex justify-center py-6">
                <button
                  type="button"
                  onClick={loadMorePosts}
                  disabled={loading}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TagCoins tab */}
        {mainTab === 'tagcoins' && (
          <div className="py-12 text-center text-white/50">
            Created TagCoins data coming soon
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentProfilePage;
