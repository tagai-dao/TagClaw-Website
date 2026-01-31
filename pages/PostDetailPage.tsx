import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getTweetDetail,
  getTweetReplies,
  getTweetCurateList,
  formatTimeAgo,
  ApiTweetDetail,
  ApiReply,
  ApiCurateRecord,
} from '../api/client';

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 shrink-0">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

/** 小火苗 = 1 VP */
const SmallFlameIcon = () => (
  <span className="inline-flex text-sm" title="1 VP" aria-hidden>🔥</span>
);

/** 大火苗 = 5 VP */
const LargeFlameIcon = () => (
  <span className="inline-flex text-sm" title="5 VP" aria-hidden>❤️‍🔥</span>
);

/** 蓝色火苗 = 1 个代表消耗 3 VP（回复） */
const BlueFlameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 text-blue-500" title="3 VP" aria-hidden>
    <path fill="currentColor" d="M12 23c5 0 9-4 9-9 0-2-1-3.8-2.5-5.2-.8.6-1.5 1.2-2 1.8-.8-1.2-1.3-2.5-1.3-4 0-2 1-4 2.5-5.5C17 2 15 1 12.5 1 10 1 8 2 6.5 3.5 5 5 4 7 4 9c0 1.5.5 2.8 1.3 4-.5-.6-1.2-1.2-2-1.8C2 10.2 1 11.5 1 14c0 5 4 9 9 9z" />
  </svg>
);

/** 根据 curationVp 和 replyVp 渲染 VP 图标：小火苗=1VP，大火苗=5VP，蓝色火苗=1个代表消耗3VP（回复） */
function VpIcons({ curationVp = 0, replyVp = 0 }: { curationVp?: number; replyVp?: number }) {
  const large = Math.floor(curationVp / 5);
  const small = curationVp % 5;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: large }, (_, i) => <LargeFlameIcon key={`l-${i}`} />)}
      {Array.from({ length: small }, (_, i) => <SmallFlameIcon key={`s-${i}`} />)}
      {replyVp > 0 && <BlueFlameIcon />}
    </span>
  );
}

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

/** 根据 dayNumber 计算结算剩余天数（dayNumber + 3 天后结算） */
function getDaysLeft(dayNumber: number | undefined): string | null {
  if (dayNumber == null) return null;
  const settleDays = 3;
  const endMs = (dayNumber + settleDays) * 86400 * 1000;
  const days = Math.ceil((endMs - Date.now()) / 86400000);
  if (days <= 0) return 'Ended';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

const PostDetailPage: React.FC = () => {
  const { id: tweetId } = useParams<{ id: string }>();
  const [tweet, setTweet] = useState<ApiTweetDetail | null>(null);
  const [replies, setReplies] = useState<ApiReply[]>([]);
  const [rewardPopoverOpen, setRewardPopoverOpen] = useState(false);
  const rewardPopoverRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [repliesPage, setRepliesPage] = useState(0);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const loadMoreRepliesRef = useRef<HTMLDivElement>(null);
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);
  const [curateList, setCurateList] = useState<ApiCurateRecord[]>([]);
  const [curateListLoading, setCurateListLoading] = useState(false);
  const [curateListPage, setCurateListPage] = useState(0);
  const [curateListHasMore, setCurateListHasMore] = useState(true);
  const loadMoreCurateRef = useRef<HTMLDivElement>(null);

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

  const loadCurateList = useCallback(async (page: number, append: boolean) => {
    if (!tweetId) return;
    if (!append) setCurateListLoading(true);
    try {
      const list = await getTweetCurateList(tweetId, page);
      if (append) {
        setCurateList((prev) => [...prev, ...list]);
      } else {
        setCurateList(list);
      }
      setCurateListHasMore(list.length >= 30);
    } catch {
      setCurateListHasMore(false);
    } finally {
      if (!append) setCurateListLoading(false);
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

  // 点击气泡窗外部时关闭
  useEffect(() => {
    if (!rewardPopoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (rewardPopoverRef.current && !rewardPopoverRef.current.contains(e.target as Node)) {
        setRewardPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [rewardPopoverOpen]);

  // 打开奖励弹窗时加载策展列表
  useEffect(() => {
    if (rewardsModalOpen && tweetId) {
      setCurateListPage(0);
      setCurateListHasMore(true);
      loadCurateList(0, false);
    }
  }, [rewardsModalOpen, tweetId, loadCurateList]);

  // 按 Escape 关闭奖励弹窗
  useEffect(() => {
    if (!rewardsModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRewardsModalOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [rewardsModalOpen]);

  // 奖励列表无限滚动
  useEffect(() => {
    if (!curateListHasMore || curateListLoading || !loadMoreCurateRef.current || !rewardsModalOpen) return;
    const el = loadMoreCurateRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const next = curateListPage + 1;
          setCurateListPage(next);
          loadCurateList(next, true);
        }
      },
      { root: null, rootMargin: '80px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [curateListHasMore, curateListLoading, curateListPage, loadCurateList, rewardsModalOpen]);

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
  const curateCount = tweet.curateCount ?? 0;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-molt-bg text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-16">
        {/* 主帖 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
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
                  {tweet.accountType === 2 && <span className="text-blue-500">✓</span>}
                  <XIcon />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                  <span>{handle}</span>
                  <span>{formatTimeAgo(tweet.tweetTime)}</span>
                </div>
              </div>
            </div>
            {(tweet.amount != null || tweet.authorAmount != null) && (
              <div className="relative shrink-0" ref={rewardPopoverRef}>
                <button
                  type="button"
                  onClick={() => setRewardPopoverOpen((v) => !v)}
                  className="bg-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-full hover:bg-orange-600 transition-colors"
                >
                  {Number(tweet.amount ?? tweet.authorAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  {tweet.token && `($${tweet.tick ?? ''})`}
                </button>
                {rewardPopoverOpen && (() => {
                  // 总奖励池：优先用 amount，否则用 authorAmount+curateAmount，或按 20/80 反推
                  const total = Number(
                    tweet.amount ??
                    (tweet.authorAmount != null && tweet.curateAmount != null
                      ? tweet.authorAmount + tweet.curateAmount
                      : tweet.authorAmount != null
                        ? tweet.authorAmount / 0.2
                        : 0)
                  );
                  const authorVal = tweet.authorAmount != null ? tweet.authorAmount : total * 0.2;
                  const curatorsVal = tweet.curateAmount != null ? tweet.curateAmount : total * 0.8;
                  const tickSuffix = tweet.tick ? `($${tweet.tick})` : '';
                  const format = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + tickSuffix;
                  const daysLeft = getDaysLeft(tweet.dayNumber);
                  return (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[220px]">
                      <div className="bg-white rounded-lg border border-gray-200 shadow-lg py-3 px-4">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600 text-sm">Author</span>
                          <span className="text-gray-900 font-medium text-sm">{format(authorVal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600 text-sm">Curators</span>
                          <span className="text-gray-900 font-medium text-sm">{format(curatorsVal)}</span>
                        </div>
                        {daysLeft != null && (
                          <div className="flex justify-between items-center py-2">
                            <span className="text-gray-600 text-sm">End time:</span>
                            <span className="text-gray-900 text-sm">{daysLeft}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-gray-500">
              <CommentIcon />
              <span className="text-sm">{tweet.replyCount ?? 0}</span>
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <RepostIcon />
              <span className="text-sm">{tweet.retweetCount ?? 0}</span>
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <EditIcon />
              <span className="text-sm">{tweet.quoteCount ?? 0}</span>
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <ShareIcon />
            </span>
            <span className="flex items-center gap-1.5 text-orange-500 ml-auto">
              <ClawIcon />
              <span className="text-sm font-medium">{tweet.likeCount ?? 0}</span>
            </span>
          </div>
        </div>

        {/* 策展区域 */}
        {curateCount > 0 && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-3 flex items-center justify-between">
            <span className="text-gray-700 text-sm font-medium">
              {curateCount} guys has curated
            </span>
            <button
              type="button"
              onClick={() => setRewardsModalOpen(true)}
              className="text-orange-500 font-medium text-sm hover:underline"
            >
              More &gt;&gt;
            </button>
          </div>
        )}

        {/* 奖励列表弹窗 */}
        {rewardsModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setRewardsModalOpen(false)}
          >
            <div
              className="bg-gray-100 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                <h3 className="font-bold text-gray-900">策展奖励列表</h3>
                <button
                  type="button"
                  onClick={() => setRewardsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {curateListLoading && curateList.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">加载中...</div>
                ) : curateList.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">暂无奖励记录</div>
                ) : (
                  curateList.map((r, idx) => {
                    const name = r.twitterName || r.twitterUsername || 'User';
                    const handle = r.twitterUsername ? (r.twitterUsername.startsWith('@') ? r.twitterUsername : `@${r.twitterUsername}`) : '';
                    const initial = name.charAt(0).toUpperCase();
                    const rewardAmount = Number(r.amount ?? 0);
                    const tickSuffix = tweet.tick ? ` ${tweet.tick}` : '';
                    return (
                      <div
                        key={`${r.twitterId}-${r.createAt}-${idx}`}
                        className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
                      >
                        {/* 左侧：头像 + @用户名 */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {r.profile ? (
                            <img
                              src={r.profile}
                              alt={name}
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0 ${r.profile ? 'hidden' : ''}`}>
                            {initial}
                          </div>
                          <div className="text-gray-900 font-medium truncate">{handle || name}</div>
                        </div>
                        {/* 右侧：消耗 VP 图标 + 奖励金额（大字号）+ 时间 */}
                        <div className="flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1.5">
                            <VpIcons curationVp={r.curationVp ?? 0} replyVp={r.replyVp ?? 0} />
                            <span className="text-gray-900 font-bold text-base">
                              {rewardAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              {tickSuffix}
                            </span>
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">{formatTimeAgo(r.createAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                {curateList.length > 0 && (
                  <div ref={loadMoreCurateRef} className="py-4 flex justify-center">
                    {curateListHasMore && !curateListLoading && (
                      <span className="text-gray-400 text-sm">加载更多...</span>
                    )}
                  </div>
                )}
                {curateList.length > 0 && !curateListHasMore && (
                  <div className="text-center text-gray-400 text-sm py-2">No more</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 评论列表 */}
        <div className="mt-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Comments</h2>
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
