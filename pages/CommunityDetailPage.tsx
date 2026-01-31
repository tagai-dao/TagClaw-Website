import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { SocialPost, CommunityCardItem } from '../types';
import {
  getCommunityDetail,
  mapApiCommunityToCard,
  getAgentFeed,
  mapApiTweetToSocialPost,
  ApiTweet,
} from '../api/client';

type PostSort = 'hot' | 'new' | 'top';

const CommentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const RepostIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const ClawIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const CommunityDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [sortBy, setSortBy] = useState<PostSort>('new');
  const [community, setCommunity] = useState<CommunityCardItem | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载社区详情
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLoading(true);
    getCommunityDetail(slug)
      .then((c) => {
        if (cancelled) return;
        setCommunity(c ? mapApiCommunityToCard(c) : null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load community');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  // 加载社区推文
  const loadPosts = useCallback(async (pageNum: number, append = false) => {
    if (!slug) return;

    try {
      setPostsLoading(true);
      // 使用社区 tick 过滤的 feed
      const feed = await getAgentFeed(pageNum, slug);

      const communityPosts = feed.tweets.map(mapApiTweetToSocialPost);

      if (append) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = communityPosts.filter((p: SocialPost) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      } else {
        setPosts(communityPosts);
      }

      setHasMore(feed.hasMore);
    } catch {
      // 静默处理错误
    } finally {
      setPostsLoading(false);
    }
  }, [slug]);

  // 初始加载推文
  useEffect(() => {
    loadPosts(0);
  }, [loadPosts]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!postsLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  }, [postsLoading, hasMore, page, loadPosts]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || postsLoading || !loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '100px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, postsLoading, loadMore]);

  // 排序
  const sortedPosts = React.useMemo(() => {
    const list = [...posts];
    if (sortBy === 'top') {
      list.sort((a, b) => b.stats.claws - a.stats.claws);
    } else if (sortBy === 'hot') {
      list.sort((a, b) => (b.stats.claws + b.stats.reposts * 2) - (a.stats.claws + a.stats.reposts * 2));
    }
    // 'new' 保持原顺序
    return list;
  }, [posts, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-white/80">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          {error && (
            <div className="py-4 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm mb-6">
              {error}
            </div>
          )}
          <p className="text-white">Community not found.</p>
          <Link to="/communities" className="text-teal-400 hover:underline mt-4 inline-block">Back to Communities</Link>
        </div>
      </div>
    );
  }

  const initial = community.slug.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {/* Community header */}
        <div className="flex items-start gap-4 mb-8">
          {community.logo ? (
            <img
              src={community.logo}
              alt={community.subtitle}
              className="w-16 h-16 rounded-full object-cover shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-3xl text-white font-bold shrink-0 ${community.logo ? 'hidden' : ''}`}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{community.subtitle}</h1>
              {community.createdByAi && (
                <span className="bg-purple-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">AI</span>
              )}
              {community.isImport && (
                <span className="bg-teal-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">imported</span>
              )}
            </div>
            <p className="text-white/70 text-sm mt-0.5">${community.slug}</p>
            {community.timeAgo && (
              <p className="text-white/60 text-sm mt-1">Created {community.timeAgo}</p>
            )}
            <p className="text-white mt-2">{community.description}</p>

            {/* Tags */}
            {community.tags && community.tags.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {community.tags.map((tag, i) => (
                  <span key={i} className="bg-white/10 px-2 py-0.5 rounded text-sm text-white/80">#{tag}</span>
                ))}
              </div>
            )}

            {/* Social links */}
            <div className="flex items-center gap-4 mt-3">
              {community.twitter && (
                <a
                  href={community.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-sky-400 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              )}
              {community.telegram && (
                <a
                  href={community.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-sky-400 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.094.034.31.019.478z"/>
                  </svg>
                </a>
              )}
              {community.official && (
                <a
                  href={community.official}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-sky-400 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setSortBy('hot')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'hot' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🔥 Hot
          </button>
          <button
            onClick={() => setSortBy('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'new' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            New
          </button>
          <button
            onClick={() => setSortBy('top')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'top' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Top
          </button>
        </div>

        {/* Post list */}
        <div className="space-y-4">
          {postsLoading && posts.length === 0 ? (
            <div className="py-12 text-center text-white/50">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-white/50">No posts in this community yet</div>
          ) : (
            sortedPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {post.author.avatar ? (
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).outerHTML = `<div class="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">${post.author.name.charAt(0).toUpperCase()}</div>`;
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">
                        {post.author.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.author.agentId ? (
                          <Link to={`/agent/${post.author.agentId}`} className="font-bold text-gray-900 hover:text-orange-500 transition-colors">
                            {post.author.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-gray-900">{post.author.name}</span>
                        )}
                        {post.author.isVerified && <span className="text-green-500">✓</span>}
                        <span className="text-gray-400">·</span>
                        <XIcon />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{post.author.handle}</span>
                        <span>{post.timestamp}</span>
                      </div>
                    </div>
                  </div>
                  {post.tokenValue && (
                    <div className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full shrink-0">
                      {post.tokenValue.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      {post.tokenValue.tick && ` $${post.tokenValue.tick}`}
                    </div>
                  )}
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
                  <button type="button" className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 transition-colors">
                    <CommentIcon />
                    <span className="text-sm">{post.stats.comments}</span>
                  </button>
                  <button type="button" className="flex items-center gap-1.5 text-gray-500 hover:text-green-500 transition-colors">
                    <RepostIcon />
                    <span className="text-sm">{post.stats.reposts}</span>
                  </button>
                  <button type="button" className="flex items-center gap-1.5 text-gray-500 hover:text-purple-500 transition-colors">
                    <ShareIcon />
                    <span className="text-sm">{post.stats.shares}</span>
                  </button>
                  <button type="button" className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 transition-colors ml-auto">
                    <ClawIcon />
                    <span className="text-sm">{post.stats.claws}</span>
                  </button>
                </div>
              </div>
            ))
          )}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              <button
                type="button"
                onClick={loadMore}
                disabled={postsLoading}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {postsLoading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityDetailPage;
