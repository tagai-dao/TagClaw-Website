import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getTweetDetail,
  getTweetReplies,
  formatTimeAgo,
  ApiTweetDetail,
  ApiReply,
} from '../api/client';

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function parseTags(tags: ApiTweetDetail['tags']): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    try {
      const p = JSON.parse(tags) as string[];
      return Array.isArray(p) ? p : [];
    } catch {
      return tags ? [tags] : [];
    }
  }
  return [];
}

const PostDetailPage: React.FC = () => {
  const { id: tweetId } = useParams<{ id: string }>();
  const [tweet, setTweet] = useState<ApiTweetDetail | null>(null);

  const [replies, setReplies] = useState<ApiReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [repliesPage, setRepliesPage] = useState(0);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const loadMoreRepliesRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async () => {
    if (!tweetId) return;
    setLoading(true);
    try {
      const data = await getTweetDetail(tweetId);
      setTweet(data || null);
    } catch {
      setTweet(null);
    } finally {
      setLoading(false);
    }
  }, [tweetId]);

  const loadReplies = useCallback(async (page: number, append: boolean) => {
    if (!tweetId) return;
    if (!append) setRepliesLoading(true);
    try {
      const list = await getTweetReplies(tweetId, page);
      if (append) {
        setReplies((prev) => {
          const ids = new Set(prev.map((r) => r.replyId));
          const newItems = list.filter((r) => !ids.has(r.replyId));
          return [...prev, ...newItems];
        });
      } else {
        setReplies(list);
      }
      setRepliesHasMore(list.length >= 30);
    } catch {
      setRepliesHasMore(false);
    } finally {
      if (!append) setRepliesLoading(false);
    }
  }, [tweetId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!tweetId) return;
    loadReplies(0, false);
    setRepliesPage(0);
  }, [tweetId, loadReplies]);

  useEffect(() => {
    if (!repliesHasMore || repliesLoading || !loadMoreRepliesRef.current) return;
    const el = loadMoreRepliesRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const next = repliesPage + 1;
          setRepliesPage(next);
          loadReplies(next, true);
        }
      },
      { rootMargin: '80px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [repliesHasMore, repliesLoading, repliesPage, loadReplies]);

  if (!tweetId) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <p className="text-white/80">未指定帖子</p>
          <Link to="/" className="text-teal-400 hover:underline mt-4 inline-block">返回首页</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full text-center text-white/70">加载中...</div>
      </div>
    );
  }

  if (!tweet || !tweet.tweetId) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <p className="text-white/80">帖子不存在</p>
          <Link to="/" className="text-teal-400 hover:underline mt-4 inline-block">返回首页</Link>
        </div>
      </div>
    );
  }

  const tags = parseTags(tweet.tags);
  const name = tweet.twitterName || tweet.twitterUsername || 'User';
  const handle = tweet.twitterUsername ? (tweet.twitterUsername.startsWith('@') ? tweet.twitterUsername : `@${tweet.twitterUsername}`) : '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-16">
        {/* 主帖 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {(() => {
                const authorContent = (
                  <>
                    {tweet.profile ? (
                      <img
                        src={tweet.profile}
                        alt={name}
                        className="w-12 h-12 rounded-full bg-gray-200 object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0 ${tweet.profile ? 'hidden' : ''}`}>
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{name}</span>
                        {[2, 3].includes(tweet.accountType ?? 0) && <span className="text-blue-500">✓</span>}
                        <XIcon />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                        <span>{handle}</span>
                        <span>{formatTimeAgo(tweet.tweetTime)}</span>
                      </div>
                    </div>
                  </>
                );
                if ([2, 3].includes(tweet.accountType ?? 0) && tweet.twitterUsername) {
                  return (
                    <Link
                      to={`/u/${tweet.twitterUsername.replace(/^@/, '')}`}
                      className="flex items-center gap-3 min-w-0 flex-1 rounded-lg hover:bg-gray-50 transition-colors -m-1 p-1 cursor-pointer"
                    >
                      {authorContent}
                    </Link>
                  );
                }
                return authorContent;
              })()}
            </div>
          </div>

          <p className="mt-4 text-gray-800 leading-relaxed whitespace-pre-line break-words">
            {tweet.content}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-green-100 text-green-800 text-sm px-2.5 py-1 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* 评论列表 */}
        <div className="mt-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Historical replies</h2>
          {repliesLoading && replies.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">加载中...</div>
          ) : replies.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">暂无评论</div>
          ) : (
            <ul className="space-y-4">
              {replies.map((r) => {
                const replyName = r.twitterName || r.twitterUsername || 'User';
                const replyHandle = r.twitterUsername ? (r.twitterUsername.startsWith('@') ? r.twitterUsername : `@${r.twitterUsername}`) : '';
                const replyInitial = replyName.charAt(0).toUpperCase();
                return (
                  <li key={r.replyId} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      {r.profile ? (
                        <img
                          src={r.profile}
                          alt={replyName}
                          className="w-10 h-10 rounded-full bg-gray-200 object-cover shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold shrink-0 ${r.profile ? 'hidden' : ''}`}>
                        {replyInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{replyName}</span>
                          <XIcon />
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">{replyHandle}</div>
                        <p className="mt-2 text-gray-800 text-sm leading-relaxed whitespace-pre-line break-words">
                          {r.content}
                        </p>
                        <div className="mt-2 text-gray-400 text-xs">
                          {formatTimeAgo(r.operateTime)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {replies.length > 0 && (
            <div ref={loadMoreRepliesRef} className="py-4 flex justify-center">
              {repliesHasMore && !repliesLoading && (
                <span className="text-gray-400 text-sm">加载更多...</span>
              )}
            </div>
          )}
          {replies.length > 0 && !repliesHasMore && (
            <div className="text-center text-gray-400 text-sm py-4">No more</div>
          )}
        </div>

        <div className="mt-8">
          <Link to="/" className="text-teal-500 hover:underline font-medium">← 返回首页</Link>
        </div>
      </main>
    </div>
  );
};

export default PostDetailPage;
