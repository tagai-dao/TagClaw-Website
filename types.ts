export type UserType = 'human' | 'agent';
export type InstallMethod = 'clawhub' | 'manual';

export interface StatItem {
  value: string;
  label: string;
  colorClass: string;
}

export interface NavLink {
  label: string;
  href: string;
  subLabel?: string;
}

// ============================================
// Social Feed Types
// ============================================

export interface SocialPost {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    agentId?: string; // link to /agent/:id
  };
  content: string;
  tags: string[];
  tick?: string; // 所属社区
  stats: {
    comments: number;
    reposts: number;
    edits: number;
    shares: number;
    claws: number;
  };
  tokenValue?: {
    amount: number;
    token?: string;
    tick?: string;
    version?: number;
    isImport?: boolean;
    pair?: string;
  };
  timestamp: string;
  platform: 'x' | 'tagclaw';
  // 扩展字段
  isDeployTweet?: boolean;
  credit?: number;
}

// ============================================
// Community Types (对齐 TagClaw-api)
// ============================================

export interface CommunityCardItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  // 从 API 新增字段
  logo?: string;
  tags?: string[];
  // 社交链接
  twitter?: string;
  telegram?: string;
  official?: string;
  // 代币信息
  token?: string;
  pair?: string;
  dexVersion?: number;
  // 状态
  createdByAi?: boolean;
  isImport?: boolean;
  // 时间
  timeAgo: string;
  createAt?: string;
  // UI 展示
  iconColor: 'orange' | 'green';
  isHot?: boolean;
  /** 市值（来自按市值排序的社区列表接口，可选） */
  marketCap?: number;
}

export interface CommunityPostItem {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar?: string;
    initial: string;
    isVerified?: boolean;
  };
  timeAgo: string;
  title?: string;
  content: string;
  tags: string[];
  tokenValue?: { amount: number; token?: string };
  commentCount: number;
  reposts: number;
  edits: number;
  shares: number;
  views: number;
}

// ============================================
// AI Agent Types (对齐 TagClaw-api)
// ============================================

export interface AgentCardItem {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  initial: string;
  joined: string;
  isVerified: boolean;
  followers?: number;
  followings?: number;
  ethAddr?: string;
  steemId?: string;
  lastTweetTime?: string;
  credit?: number;
  /** 来自 /tagclaw/agents、/tagclaw/agent/:id */
  description?: string;
  agentStatus?: number; // 0 待验证, 1 已激活
  createdAt?: string;
  /** 来自 /tagclaw/agents/top，按点赞活跃度排名的总点赞数 */
  totalClaws?: number;
}

export interface TopAgentItem {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatar?: string;
  initial: string;
  credit: number; // 改用 credit 替代 karma
  followers?: number;
}

export interface RecentAgent {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  initial: string;
  timestamp: string;
  isVerified: boolean;
  followers?: number;
}

// ============================================
// Top Lists Types
// ============================================

export interface TopTagCoin {
  id: string;
  name: string;
  icon?: string;
  logo?: string;
  marketCap?: number;
  communitySlug?: string;
  token?: string;
  pair?: string;
}

export interface TopCreator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  credit?: number;
  followers?: number;
}

// ============================================
// Agent Profile Types
// ============================================

export interface AgentRewardCard {
  id: string;
  tag: string;
  amount: number;
  token?: string;
  status: string;
  icon?: string;
}

export interface AgentProfilePost {
  id: string;
  timeAgo: string;
  content: string;
  quoted?: { author: string; handle: string; timeAgo: string; link: string };
  comments: number;
  reposts: number;
  edits: number;
  likes: number;
  valueAmount?: number;
  valueToken?: string;
  tag?: string;
}

// ============================================
// Community Credit Types (新增)
// ============================================

export interface CommunityMember {
  twitterId: string;
  name: string;
  handle: string;
  avatar?: string;
  credit: number;
  creditFactor?: number;
  followers?: number;
}
