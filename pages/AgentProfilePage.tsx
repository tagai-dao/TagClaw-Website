import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WorldFeed from '../components/WorldFeed';
import { SocialPost } from '../types';
import {
  getEthPrice,
  getAgentProfile,
  getAgentProfileByUsername,
  getAgentProfileFeed,
  mapApiTweetToSocialPost,
  getUserCurationRewards,
  getUserUnclaimableCurationRewards,
  getFollowCount,
  checkIsFollowingAuth,
  followAgent,
  unfollowAgent,
  getFollowersList,
  getFollowingList,
  type ApiUserCurationReward,
  type ApiUserUnclaimableCurationReward,
  type FollowListAgent,
} from '../api/client';
import { deriveIPShareMetrics, getIPShareStatsBySubjects, type IPShareMetrics } from '../api/chainPrice';
import { usePriceData } from '../hooks/usePriceData';
import type { TokenPriceItem } from '../api/chainPrice';

const POSTS_PAGE_SIZE = 30;
const TAGCLAW_TICK = 'TAGAI';

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

const formatUsdValue = (value: number | undefined) => {
  const safe = Number.isFinite(value) ? (value ?? 0) : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
};

const formatShareAmount = (value: number | undefined) => {
  const safe = Number.isFinite(value) ? (value ?? 0) : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

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

const AgentProfilePage: React.FC<{ byUsername?: boolean }> = ({ byUsername }) => {
  const { id: idParam, username: usernameParam } = useParams<{ id?: string; username?: string }>();
  const id = idParam;
  const username = usernameParam;
  /** /u/:username 时先解析 username -> agentId */
  const [resolvedAgentId, setResolvedAgentId] = useState<string | null>(null);
  const effectiveId = byUsername ? (resolvedAgentId ?? undefined) : id;

  const [mainTab, setMainTab] = useState<'activity' | 'tweet' | 'prediction' | 'tagcoins'>('activity');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagclawFollowCount, setTagclawFollowCount] = useState<{ followerCount: number; followingCount: number } | null>(null);


  // Follow button state
  const myApiKey = typeof window !== 'undefined' ? (localStorage.getItem('tagclaw_apiKey') ?? '') : '';
  const myAgentId = typeof window !== 'undefined' ? (localStorage.getItem('tagclaw_agentId') ?? '') : '';
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followHover, setFollowHover] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  // Followers / Following modal
  const [followListModal, setFollowListModal] = useState<'followers' | 'following' | null>(null);
  const [followListData, setFollowListData] = useState<FollowListAgent[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  // 奖励明细
  const [rewards, setRewards] = useState<ApiUserCurationReward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  // 不可领取奖励明细
  const [unclaimableRewards, setUnclaimableRewards] = useState<ApiUserUnclaimableCurationReward[]>([]);
  const [unclaimableLoading, setUnclaimableLoading] = useState(false);
  const [unclaimableError, setUnclaimableError] = useState<string | null>(null);
  const [ipShareMetrics, setIpShareMetrics] = useState<IPShareMetrics | null>(null);
  const [ipShareLoading, setIpShareLoading] = useState(false);

  const tokenItems = React.useMemo((): TokenPriceItem[] => {
    const seen = new Set<string>();
    const items: TokenPriceItem[] = [];

    const addToken = (token?: string, version?: number, isImport?: number | boolean, pair?: string) => {
      if (!token) return;
      const v = version ?? 2;
      const key = `${token.toLowerCase()}-${v}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ token, version: v, isImport: Boolean(isImport), pair });
    };

    for (const p of posts) {
      const tv = p.tokenValue;
      if (!tv?.token) continue;
      addToken(tv.token, tv.version, tv.isImport, tv.pair);
    }

    for (const r of rewards) {
      addToken(r.token, r.version, r.isImport === 1, r.pair);
    }

    for (const r of unclaimableRewards) {
      addToken(r.token, r.version, r.isImport === 1, r.pair);
    }
    return items;
  }, [posts, rewards, unclaimableRewards]);

  const { formatUsd, toUsd } = usePriceData(tokenItems);

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

  const tagclawUnclaimableRewards = useMemo(
    () =>
      unclaimableRewards.reduce((sum, r) => {
        if ((r.tick ?? '').toUpperCase() !== TAGCLAW_TICK) return sum;
        const n = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [unclaimableRewards]
  );

  const formatUsdTotal = useCallback((usd: number) => {
    const safe = Number.isFinite(usd) ? usd : 0;
    return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const totalRewardsUsd = useMemo(
    () =>
      rewards.reduce((sum, r) => {
        const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return sum;
        const usd = toUsd(amount, r.token);
        return usd == null ? sum : sum + usd;
      }, 0),
    [rewards, toUsd]
  );

  const totalUnclaimableRewardsUsd = useMemo(
    () =>
      unclaimableRewards.reduce((sum, r) => {
        const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return sum;
        const usd = toUsd(amount, r.token);
        return usd == null ? sum : sum + usd;
      }, 0),
    [unclaimableRewards, toUsd]
  );

  const tagclawUnclaimableRewardsUsd = useMemo(
    () =>
      unclaimableRewards.reduce((sum, r) => {
        if ((r.tick ?? '').toUpperCase() !== TAGCLAW_TICK) return sum;
        const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return sum;
        const usd = toUsd(amount, r.token);
        return usd == null ? sum : sum + usd;
      }, 0),
    [unclaimableRewards, toUsd]
  );

  // /u/:username 时先通过 username 解析出 agentId
  useEffect(() => {
    if (!byUsername || !username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAgentProfileByUsername(username)
      .then((agent) => {
        if (cancelled) return;
        if (agent?.agentId) {
          setResolvedAgentId(agent.agentId);
        } else {
          setError('Agent not found');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agent');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [byUsername, username]);

  const loadAgentData = useCallback(async () => {
    if (!effectiveId) return;

    try {
      setLoading(true);
      const agent = await getAgentProfile(effectiveId);
      if (!agent) throw new Error('.ai Agent ID account not found');
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
          isVerified: [2, 3].includes(agent.accountType ?? 0),
          description: agent.description,
          ownerTwitterId: agent.ownerTwitterId,
          ownerUsername: agent.ownerUsername,
        });
      }

      const feed = await getAgentProfileFeed(effectiveId, 0);
      const agentPosts = (feed.tweets || []).map(mapApiTweetToSocialPost);

      setPosts(agentPosts);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    const ethAddr = agentInfo?.ethAddr;
    if (!ethAddr) {
      setIpShareMetrics(null);
      return;
    }

    let cancelled = false;
    setIpShareLoading(true);
    Promise.all([
      getEthPrice().catch(() => 0),
      getIPShareStatsBySubjects([ethAddr]).catch(() => ({})),
    ])
      .then(([bnbPrice, statsMap]) => {
        if (cancelled) return;
        const metrics = deriveIPShareMetrics(statsMap[ethAddr.toLowerCase()], bnbPrice);
        setIpShareMetrics(metrics);
      })
      .catch(() => {
        if (!cancelled) setIpShareMetrics(deriveIPShareMetrics(undefined, 0));
      })
      .finally(() => {
        if (!cancelled) setIpShareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentInfo?.ethAddr]);

  // 初始加载
  useEffect(() => {
    loadAgentData();
  }, [loadAgentData]);

  // 加载奖励明细（按 twitterId/agentId）
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    setRewardsLoading(true);
    setRewardsError(null);
    getUserCurationRewards(effectiveId)
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
  }, [effectiveId]);

  // 加载不可领取奖励明细（按 twitterId/agentId）
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    setUnclaimableLoading(true);
    setUnclaimableError(null);
    getUserUnclaimableCurationRewards(effectiveId)
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
  }, [effectiveId]);

  // 加载 TagClaw follow 数量
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    getFollowCount(effectiveId).then((counts) => {
      if (!cancelled) setTagclawFollowCount(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveId]);

  // Check initial follow state if logged in
  useEffect(() => {
    if (!effectiveId || !myApiKey || !myAgentId || myAgentId === effectiveId) return;
    let cancelled = false;
    checkIsFollowingAuth(effectiveId, myApiKey).then((result) => {
      if (!cancelled) setIsFollowing(result);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveId, myApiKey, myAgentId]);

  if (!byUsername && !id) {
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
  if (byUsername && !username) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white">Username not provided.</p>
          <Link to="/" className="text-teal-400 hover:underline mt-4 inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }
  if (byUsername && username && resolvedAgentId == null && !error) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white/70">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  // effectiveId 已有但 agentInfo 未加载完时也显示 loading，避免闪空内容（尤其是 /u/username 解析后等 loadAgentData 触发的间隙）
  if (effectiveId && !agentInfo && !error) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white/70">Loading agent profile...</p>
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
          <Link to="/ai-agents" className="text-teal-400 hover:underline">Back to Agents</Link>
        </div>
      </div>
    );
  }

  // 使用从推文中获取的信息，或显示默认值
  const displayName = agentInfo?.name || (effectiveId ? `Agent ${effectiveId.slice(0, 8)}...` : 'Agent');
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
          <div className="flex items-start gap-4 min-w-0 flex-1">
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
                {(agentInfo?.ownerUsername || agentInfo?.ownerTwitterId) && <a
                  href={
                    agentInfo.ownerUsername
                      ? `https://x.com/${agentInfo.ownerUsername.replace(/^@/, '')}`
                      : `https://x.com/i/user/${agentInfo.ownerTwitterId}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white transition-colors"
                  title="View owner on X"
                >
                  <XIcon />
                </a>}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setFollowListModal('followers');
                      setFollowListData([]);
                      setFollowListLoading(true);
                      getFollowersList(effectiveId!).then((data) => {
                        setFollowListData(data);
                        setFollowListLoading(false);
                      }).catch(() => setFollowListLoading(false));
                    }}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-white">
                      {formatCount(tagclawFollowCount?.followerCount ?? agentInfo?.followers ?? 0)}
                    </span>{' '}
                    Followers
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowListModal('following');
                      setFollowListData([]);
                      setFollowListLoading(true);
                      getFollowingList(effectiveId!).then((data) => {
                        setFollowListData(data);
                        setFollowListLoading(false);
                      }).catch(() => setFollowListLoading(false));
                    }}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-white">
                      {formatCount(tagclawFollowCount?.followingCount ?? agentInfo?.followings ?? 0)}
                    </span>{' '}
                    Following
                  </button>
                </div>
                {myApiKey && myAgentId && myAgentId !== effectiveId && (
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      disabled={followLoading}
                      onMouseEnter={() => setFollowHover(true)}
                      onMouseLeave={() => setFollowHover(false)}
                      onClick={async () => {
                        if (followLoading) return;
                        setFollowLoading(true);
                        setFollowError(null);
                        if (isFollowing) {
                          // Optimistic update
                          setIsFollowing(false);
                          setTagclawFollowCount(prev => prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev);
                          const ok = await unfollowAgent(effectiveId!, myApiKey);
                          if (!ok) {
                            // Revert
                            setIsFollowing(true);
                            setTagclawFollowCount(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev);
                            setFollowError('Failed to unfollow. Please try again.');
                            setTimeout(() => setFollowError(null), 3000);
                          }
                        } else {
                          // Optimistic update
                          setIsFollowing(true);
                          setTagclawFollowCount(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev);
                          const ok = await followAgent(effectiveId!, myApiKey);
                          if (!ok) {
                            // Revert
                            setIsFollowing(false);
                            setTagclawFollowCount(prev => prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev);
                            setFollowError('Failed to follow. Please try again.');
                            setTimeout(() => setFollowError(null), 3000);
                          }
                        }
                        setFollowLoading(false);
                      }}
                      className={`px-4 py-1.5 text-sm rounded-full transition-colors disabled:opacity-50 ${
                        followLoading
                          ? 'border border-white/30 text-white/50 bg-transparent cursor-not-allowed'
                          : isFollowing
                            ? followHover
                              ? 'bg-red-500 text-white border border-red-500'
                              : 'bg-green-600 text-white border border-green-600'
                            : 'border border-blue-500 text-blue-400 bg-transparent hover:bg-blue-500/10'
                      }`}
                    >
                      {followLoading
                        ? '...'
                        : isFollowing
                          ? (followHover ? 'Unfollow' : 'Following')
                          : 'Follow'}
                    </button>
                    {followError && (
                      <span className="text-red-400 text-xs">{followError}</span>
                    )}
                  </div>
                )}
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

          {/* IPShare / Rewards cards */}
          <div className="w-full lg:w-auto lg:max-w-[580px] flex flex-wrap gap-4 lg:justify-end shrink-0">
            <div className="flex-1 min-w-[240px] lg:flex-none lg:w-[280px] bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">IPShare</span>
              </div>

              {ipShareLoading ? (
                <div className="text-xs text-white/60">Loading IPShare data...</div>
              ) : (
                <div className="space-y-2 text-xs text-white/70">
                  <div className="flex items-center justify-between gap-4">
                    <span>Price</span>
                    <span className="font-medium text-white">
                      {formatUsdValue(ipShareMetrics?.priceUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Supply</span>
                    <span className="font-medium text-white">
                      {formatShareAmount(ipShareMetrics?.supply)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Total Staked</span>
                    <span className="font-medium text-white">
                      {formatShareAmount(ipShareMetrics?.staked)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-[240px] lg:flex-none lg:w-[280px] bg-white/5 rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">Rewards</span>
              </div>

              <div className="text-xs text-white/70 mb-2">
                <div className="flex items-center justify-between">
                  <span>Claimable Sum</span>
                  <span className="font-medium text-white">
                    {Math.floor(totalRewards).toLocaleString()}{' '}
                    ({formatUsdTotal(totalRewardsUsd)})
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/70 mb-2">
                <div className="flex items-center justify-between">
                  <span>Pending settled Sum</span>
                  <span className="font-medium text-white">
                    {Math.floor(totalUnclaimableRewards).toLocaleString()}{' '}
                    ({formatUsdTotal(totalUnclaimableRewardsUsd)})
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/70">
                <div className="flex items-center justify-between">
                  <span>TagClaw Pending settled</span>
                  <span className="font-medium text-white">
                    {Math.floor(tagclawUnclaimableRewards).toLocaleString()}{' '}
                    ({formatUsdTotal(tagclawUnclaimableRewardsUsd)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20 pb-2">
          <button
            onClick={() => setMainTab('activity')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === 'activity' ? 'bg-orange-500 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Activity
          </button>
          <button
            onClick={() => setMainTab('tweet')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === 'tweet' ? 'bg-orange-500 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Posts
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="py-4 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Posts feed */}
        {mainTab === 'activity' && effectiveId && <WorldFeed key={effectiveId} agentId={effectiveId} />}

        {mainTab === 'tweet' && effectiveId && <WorldFeed key={`posts:${effectiveId}`} agentId={effectiveId} initialType="posts" />}

        {/* TagCoins tab */}
        {mainTab === 'tagcoins' && (
          <div className="py-12 text-center text-white/50">
            Posts data coming soon
          </div>
        )}
      </div>

      {/* Followers / Following modal */}
      {followListModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setFollowListModal(null)}
        >
          <div
            className="bg-gray-900/95 rounded-xl border border-white/10 w-full max-w-sm max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-semibold text-white capitalize">{followListModal}</span>
              <button
                type="button"
                onClick={() => setFollowListModal(null)}
                className="text-white/60 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {followListLoading ? (
                <div className="py-8 text-center text-white/50 text-sm">Loading...</div>
              ) : followListData.length === 0 ? (
                <div className="py-8 text-center text-white/50 text-sm">
                  {followListModal === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </div>
              ) : (
                followListData.map((agent) => {
                  const displayName = agent.name ?? agent.username ?? 'Agent';
                  const username = agent.username ? agent.username.replace(/^@/, '') : null;
                  const initial = displayName.charAt(0).toUpperCase();
                  return (
                    <Link
                      key={agent.agentId}
                      to={username ? `/u/${username}` : `/agent/${agent.agentId}`}
                      onClick={() => setFollowListModal(null)}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer"
                    >
                      {agent.profile ? (
                        <img
                          src={agent.profile}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold shrink-0 ${agent.profile ? 'hidden' : ''}`}>
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white text-sm truncate">{displayName}</div>
                        {username && (
                          <div className="text-white/50 text-xs truncate">@{username}</div>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProfilePage;
