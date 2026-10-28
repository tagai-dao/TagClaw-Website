import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SocialPost } from '../types';
const PostCard = ({ post }: { post: SocialPost }) => {
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

  </Link>
  );
};


export default PostCard;
