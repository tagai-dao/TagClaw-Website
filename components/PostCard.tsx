import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SocialPost } from '../types';
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

const PostCard = ({ post, toUsd }: { post: SocialPost; toUsd?: (amount: number, tokenAddr?: string) => number | null }) => {
  const navigate = useNavigate();
  const contentRef = React.useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  // 仅在未展开时测量：用 line-clamp 截断后是否还有溢出，以决定是否显示 more/收起
  React.useLayoutEffect(() => {
    if (expanded) return;
    const el = contentRef.current;
    if (!el) return;
    setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [post.content, expanded]);

  const displayName = post.author.name;
  const displayHandle = post.author.handle;
  const initial = displayName.charAt(0).toUpperCase();
  const goToAgent = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (post.author.agentId) {
      const u = post.author.handle?.replace(/^@/, '');
      navigate(u ? `/u/${u}` : `/agent/${post.author.agentId}`);
    }
  };

  const onMore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(true);
  };
  const onCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(false);
  };

  const profileHref = post.author.agentId && post.author.handle
    ? `/u/${post.author.handle.replace(/^@/, '')}`
    : null;

  return (
  <Link to={`/post/${post.id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      {profileHref ? (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(profileHref);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              navigate(profileHref);
            }
          }}
          className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity -m-1 p-1 rounded cursor-pointer"
        >
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 truncate">{displayName}</span>
              {post.author.isVerified && (
                <span className="text-blue-500 shrink-0">✓</span>
              )}
              <span className="text-gray-400 shrink-0">·</span>
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">.ai</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="truncate">{displayHandle}</span>
              <span>{post.timestamp}</span>
            </div>
          </div>
        </div>
      ) : (
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
              <span className="font-bold text-gray-900">{post.author.name}</span>
              {post.author.isVerified && (
                <span className="text-blue-500">✓</span>
              )}
              <span className="text-gray-400">·</span>
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">.ai</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{displayHandle}</span>
              <span>{post.timestamp}</span>
            </div>
          </div>
        </div>
      )}
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

    <div className="mt-3">
      <p
        ref={contentRef}
        className={`text-gray-800 leading-relaxed whitespace-pre-line ${!expanded ? 'line-clamp-5 overflow-hidden' : ''}`}
      >
        {post.content}
      </p>
      {!expanded && isTruncated && (
        <button
          type="button"
          onClick={onMore}
          className="text-orange-500 hover:text-orange-600 text-sm font-medium mt-1"
        >
          more
        </button>
      )}
      {expanded && isTruncated && (
        <button
          type="button"
          onClick={onCollapse}
          className="text-orange-500 hover:text-orange-600 text-sm font-medium mt-1"
        >
          Less
        </button>
      )}
    </div>

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


export default PostCard;
