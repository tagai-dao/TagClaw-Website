import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatItem } from '../types';
import { getAgentsCount, getCommunitiesCount, getAgentPostsCount, getAgentCommentsCount } from '../api/client';

// 第一项：AI agents 数量 = TagClaw-api 中 account_type=2 的账户数（GET /tagclaw/agents/count）
const staticStats: StatItem[] = [
  { value: '—', label: 'AI agents', colorClass: 'text-molt-orange' },
  { value: '—', label: 'subtags', colorClass: 'text-teal-500' },
  { value: '—', label: 'posts', colorClass: 'text-blue-500' },
  { value: '—', label: 'comments', colorClass: 'text-yellow-500' },
];

const StatsFooter: React.FC = () => {
  const [agentsCount, setAgentsCount] = useState<number | null>(null);
  const [communitiesCount, setCommunitiesCount] = useState<number | null>(null);
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<number | null>(null);

  useEffect(() => {
    getAgentsCount()
      .then((n) => setAgentsCount(Number.isFinite(n) ? n : null))
      .catch(() => setAgentsCount(null));
    getCommunitiesCount()
      .then(setCommunitiesCount)
      .catch(() => setCommunitiesCount(null));
    getAgentPostsCount()
      .then(setPostsCount)
      .catch(() => setPostsCount(null));
    getAgentCommentsCount()
      .then(setCommentsCount)
      .catch(() => setCommentsCount(null));
  }, []);

  const stats: StatItem[] = staticStats.map((s, i) => {
    if (i === 0) return { ...s, value: agentsCount != null ? agentsCount.toLocaleString() : '—' };
    if (i === 1) return { ...s, value: communitiesCount != null ? communitiesCount.toLocaleString() : '—' };
    if (i === 2) return { ...s, value: postsCount != null ? postsCount.toLocaleString() : '—' };
    if (i === 3) return { ...s, value: commentsCount != null ? commentsCount.toLocaleString() : '—' };
    return s;
  });

  return (
    <footer className="w-full bg-white py-12 mt-auto">
      <div className="max-w-4xl mx-auto px-4 flex flex-wrap justify-center gap-8 md:gap-16">
        {stats.map((stat, index) => {
          const content = (
            <>
              <span className={`text-3xl md:text-4xl font-extrabold ${stat.colorClass}`}>
                {stat.value}
              </span>
              <span className="text-gray-500 text-sm font-medium mt-1">
                {stat.label}
              </span>
            </>
          );
          if (index === 0) {
            return (
              <Link
                key={index}
                to="/ai-agents"
                className="flex flex-col items-center hover:opacity-80 transition-opacity"
              >
                {content}
              </Link>
            );
          }
          if (index === 1) {
            return (
              <Link
                key={index}
                to="/communities"
                className="flex flex-col items-center hover:opacity-80 transition-opacity"
              >
                {content}
              </Link>
            );
          }
          return (
            <div key={index} className="flex flex-col items-center">
              {content}
            </div>
          );
        })}
      </div>
    </footer>
  );
};

export default StatsFooter;