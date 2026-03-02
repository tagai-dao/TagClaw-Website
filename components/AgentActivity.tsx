import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  getAgentActivity,
  getAgentTxStats,
  type AgentActivityItem,
  type AgentActivityAgent,
} from '../api/client';

// ============================================
// Types
// ============================================

type TxType = 'claim' | 'buy' | 'sell' | 'transfer' | 'trade';

interface TokenNode {
  id: string;
  tick: string;
  logo: string;
  x: number;
  y: number;
  radius: number;
  imgLoaded: boolean;
  imgEl?: HTMLImageElement;
  pulsePhase: number;
  agentCount: number;
}

interface AgentNode {
  id: string;
  name: string;
  initial: string;
  tickId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wanderAngle: number;
  wanderTimer: number;
  homeRadius: number;
  radius: number;
  lastTx?: TxType;
  lastAmount?: string;
  lastTick?: string;
  labelOpacity: number;
  pulsePhase: number;
  imgLoaded?: boolean;
  imgEl?: HTMLImageElement;
}

interface FeedItem {
  id: string;
  agentName: string;
  agentInitial: string;
  agentProfile: string;
  type: TxType;
  amount: string;
  token: string;
  tick: string;
  hash: string;
  communityLogo: string;
  timestamp: number;
  isClaimed: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

// ============================================
// Constants
// ============================================

const TX_COLORS: Record<TxType, string> = {
  claim: '#3b82f6', buy: '#22c55e', sell: '#ef4444',
  transfer: '#a855f7', trade: '#f59e0b',
};
const TX_LABELS: Record<TxType, string> = {
  claim: 'CLAIM', buy: 'BUY', sell: 'SELL',
  transfer: 'TRANSFER', trade: 'TRADE',
};
const TX_BG_COLORS: Record<TxType, string> = {
  claim: 'rgba(59,130,246,0.15)', buy: 'rgba(34,197,94,0.15)',
  sell: 'rgba(239,68,68,0.15)', transfer: 'rgba(168,85,247,0.15)',
  trade: 'rgba(245,158,11,0.15)',
};

function rand(a: number, b: number) { return Math.random() * (b - a) + a; }

function fmtAmount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n < 0.001 && n > 0) return n.toExponential(1);
  if (n < 1) return n.toFixed(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function normalizeActivityTimestamp(act: AgentActivityItem): number {
  // 1) 优先使用后端返回的 txTimestamp（目标：毫秒级）
  const rawTs = act.txTimestamp;
  if (rawTs !== null && rawTs !== undefined && rawTs !== '') {
    const n = Number(rawTs);
    if (Number.isFinite(n) && n > 0) {
      // 兼容秒级时间戳（10 位）场景，统一转成毫秒
      return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
    }
  }

  // 2) 回退旧字段 claimedAt（datetime 字符串）
  const parsed = Date.parse(act.claimedAt || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function classifyTx(a: AgentActivityItem): TxType {
  // 后端已经根据业务语义给出了 type，这里只做直接映射，并为未来的 buy/sell 预留
  if (a.type === 'buy') return 'buy';
  if (a.type === 'sell') return 'sell';
  if (a.type === 'transfer') return 'transfer';
  if (a.type === 'trade') return 'trade';
  return 'claim';
}

function activityEventKey(act: Pick<AgentActivityItem, 'id' | 'hash' | 'tradeHash'>): string {
  return act.hash || act.tradeHash || act.id;
}

function hexRgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
}

function loadImg(src: string, node: { imgLoaded: boolean; imgEl?: HTMLImageElement }) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { node.imgLoaded = true; node.imgEl = img; };
  img.src = src;
}

// ============================================
// Canvas helpers
// ============================================

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderCanvas(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  tokens: TokenNode[], agents: AgentNode[], particles: Particle[], dpr: number,
) {
  ctx.save();
  ctx.scale(dpr, dpr);

  // BG
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(34,197,94,0.03)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 50) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

  // Orbit zone rings (behind everything)
  for (const tk of tokens) {
    const orbiting = agents.filter(a => a.tickId === tk.id);
    if (orbiting.length === 0) continue;
    const maxDist = Math.max(...orbiting.map(a => {
      const dx = a.x - tk.x;
      const dy = a.y - tk.y;
      return Math.sqrt(dx * dx + dy * dy);
    }));
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 8]);
    ctx.beginPath();
    ctx.arc(tk.x, tk.y, maxDist + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Connection lines from agents to their token
  for (const a of agents) {
    const tk = tokens.find(t => t.id === a.tickId);
    if (!tk) continue;
    const color = a.lastTx ? TX_COLORS[a.lastTx] : '#1f2937';
    ctx.strokeStyle = `rgba(${hexRgb(color)},0.12)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tk.x, tk.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  }

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = (p.life / p.maxLife) * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Token nodes
  for (const tk of tokens) {
    // Outer glow
    const pulse = 0.15 + Math.sin(tk.pulsePhase) * 0.08;
    const grad = ctx.createRadialGradient(tk.x, tk.y, tk.radius * 0.5, tk.x, tk.y, tk.radius * 3);
    grad.addColorStop(0, `rgba(249,115,22,${pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(tk.x, tk.y, tk.radius * 3, 0, Math.PI * 2); ctx.fill();

    // Circle bg
    ctx.fillStyle = '#1a1f2e';
    ctx.beginPath(); ctx.arc(tk.x, tk.y, tk.radius, 0, Math.PI * 2); ctx.fill();

    // Border
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(tk.x, tk.y, tk.radius, 0, Math.PI * 2); ctx.stroke();

    // Logo or text
    ctx.save();
    ctx.beginPath(); ctx.arc(tk.x, tk.y, tk.radius - 3, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (tk.imgLoaded && tk.imgEl) {
      const s = (tk.radius - 3) * 2;
      ctx.drawImage(tk.imgEl, tk.x - s / 2, tk.y - s / 2, s, s);
    } else {
      ctx.fillStyle = '#f97316';
      ctx.font = `bold ${tk.radius * 0.5}px -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tk.tick.slice(0, 4).toUpperCase(), tk.x, tk.y);
    }
    ctx.restore();

    // Tick label below
    ctx.fillStyle = '#f97316';
    ctx.font = `bold ${Math.max(11, tk.radius * 0.35)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(tk.tick, tk.x, tk.y + tk.radius + 16);
  }

  // Agent nodes
  for (const a of agents) {
    const color = a.lastTx ? TX_COLORS[a.lastTx] : '#4b5563';

    // Glow
    const pulse = 0.2 + Math.sin(a.pulsePhase) * 0.1;
    const grad = ctx.createRadialGradient(a.x, a.y, a.radius * 0.3, a.x, a.y, a.radius * 2.2);
    grad.addColorStop(0, `rgba(${hexRgb(color)},${pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.radius * 2.2, 0, Math.PI * 2); ctx.fill();

    // Avatar
    ctx.save();
    ctx.beginPath(); ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (a.imgLoaded && a.imgEl) {
      ctx.drawImage(a.imgEl, a.x - a.radius, a.y - a.radius, a.radius * 2, a.radius * 2);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(a.x - a.radius, a.y - a.radius, a.radius * 2, a.radius * 2);
      ctx.fillStyle = color;
      ctx.font = `bold ${a.radius * 0.8}px -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(a.initial, a.x, a.y + 1);
    }
    ctx.restore();

    // Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.radius + 1, 0, Math.PI * 2); ctx.stroke();

    // Name
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 ${Math.max(9, a.radius * 0.42)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    const dn = a.name.length > 12 ? a.name.slice(0, 11) + '…' : a.name;
    ctx.fillText(dn, a.x, a.y + a.radius + 13);

    // Tx label
    if (a.lastTx && a.labelOpacity > 0.01) {
      ctx.globalAlpha = Math.min(a.labelOpacity, 1);
      const txC = TX_COLORS[a.lastTx];
      const label = `${TX_LABELS[a.lastTx]} ${a.lastAmount || ''}`;
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(label).width;
      const lx = a.x - tw / 2 - 6;
      const ly = a.y - a.radius - 22;
      drawRoundedRect(ctx, lx, ly, tw + 12, 18, 4);
      ctx.fillStyle = `rgba(${hexRgb(txC)},0.3)`;
      ctx.fill();
      ctx.strokeStyle = txC; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = txC; ctx.textAlign = 'center';
      ctx.fillText(label, a.x, ly + 13);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

// ============================================
// Component
// ============================================

const AgentActivity: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tokensRef = useRef<TokenNode[]>([]);
  const agentsRef = useRef<AgentNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const replayIdxRef = useRef(0);
  const lastReplayTimeRef = useRef(0);
  const activitiesRef = useRef<AgentActivityItem[]>([]);
  const apiAgentsRef = useRef<AgentActivityAgent[]>([]);
  const feedListRef = useRef<HTMLDivElement>(null);
  const sceneBuiltForRef = useRef('');
  const latestTsRef = useRef(0);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState({ totalVol: 0, txCount: 0, activeAgents: 0, claims: 0, trades: 0 });
  const [isLive, setIsLive] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);

  // ---- helpers ----

  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * rand(0.5, 2),
        vy: Math.sin(angle) * rand(0.5, 2),
        life: 45, maxLife: 45, color, size: rand(1.5, 3),
      });
    }
  }, []);

  const actToFeedItem = useCallback((act: AgentActivityItem, idx: number): FeedItem => ({
    id: `${act.id}-${idx}`,
    agentName: act.agentName || 'Agent',
    agentInitial: (act.agentName || 'A').charAt(0).toUpperCase(),
    agentProfile: act.agentProfile || '',
    type: classifyTx(act),
    amount: fmtAmount(act.amount),
    token: act.token || '',
    tick: act.tick || '',
    hash: act.hash || '',
    communityLogo: act.communityLogo || '',
    timestamp: normalizeActivityTimestamp(act),
    isClaimed: act.isClaimed,
  }), []);

  // Build token center nodes + agent orbit nodes
  const buildScene = useCallback((
    activities: AgentActivityItem[],
    agents: AgentActivityAgent[],
    w: number, h: number,
  ) => {
    // 1. Collect unique ticks with logos and activity counts
    const tickMap = new Map<string, { logo: string; agents: Set<string>; txCount: number }>();
    for (const act of activities) {
      if (!act.tick) continue;
      if (!tickMap.has(act.tick)) tickMap.set(act.tick, { logo: act.communityLogo || '', agents: new Set(), txCount: 0 });
      const entry = tickMap.get(act.tick)!;
      // 兼容首条活动缺 logo 的场景：后续出现非空 logo 时补齐
      if (!entry.logo && act.communityLogo) entry.logo = act.communityLogo;
      entry.agents.add(act.agentId);
      entry.txCount++;
    }

    if (tickMap.size === 0) {
      tickMap.set('TagClaw', { logo: '', agents: new Set(agents.map(a => a.agentId)), txCount: activities.length });
    }

    // Sort by activity: most active first
    const tickEntries = [...tickMap.entries()].sort((a, b) => b[1].txCount - a[1].txCount);
    const agentMap = new Map<string, AgentActivityAgent>();
    for (const a of agents) agentMap.set(a.agentId, a);

    // 2. Compute weights: each token gets area proportional to its agent count
    const totalAgentSlots = tickEntries.reduce((s, [, info]) => s + info.agents.size, 0) || 1;
    const weights = tickEntries.map(([, info]) => Math.max(info.agents.size / totalAgentSlots, 0.15));
    const weightSum = weights.reduce((s, w2) => s + w2, 0);
    const normalizedWeights = weights.map(w2 => w2 / weightSum);

    // Token radius scales with weight: more agents → bigger token
    const minTkR = 24;
    const maxTkR = Math.min(60, Math.min(w, h) / 5);
    const tokenRadii = normalizedWeights.map(nw => minTkR + (maxTkR - minTkR) * Math.sqrt(nw * tickEntries.length));

    // 3. Layout tokens with spacing proportional to their "territory"
    const tokenNodes: TokenNode[] = [];
    const pad = 80;

    if (tickEntries.length === 1) {
      const [tick, info] = tickEntries[0];
      const r = tokenRadii[0];
      const tn: TokenNode = {
        id: tick, tick, logo: info.logo,
        x: w / 2, y: h / 2, radius: r,
        imgLoaded: false, pulsePhase: 0, agentCount: info.agents.size,
      };
      if (info.logo) loadImg(info.logo, tn);
      tokenNodes.push(tn);
    } else {
      // Place tokens along a weighted arc so bigger ones get more room
      const cx = w / 2;
      const cy = h / 2;
      const availW = w - pad * 2;
      const availH = h - pad * 2;

      // For 2 tokens: place them side by side; for 3+: use elliptical layout
      if (tickEntries.length === 2) {
        const spacing = availW * 0.18;
        tickEntries.forEach(([tick, info], i) => {
          const r = tokenRadii[i];
          const xOff = i === 0 ? -spacing : spacing;
          const tn: TokenNode = {
            id: tick, tick, logo: info.logo,
            x: cx + xOff, y: cy, radius: r,
            imgLoaded: false, pulsePhase: rand(0, Math.PI * 2), agentCount: info.agents.size,
          };
          if (info.logo) loadImg(info.logo, tn);
          tokenNodes.push(tn);
        });
      } else {
        // Cumulative angle allocation: each token gets angular span proportional to weight
        let cumulAngle = -Math.PI / 2;
        const ellipseRx = availW * 0.2;
        const ellipseRy = availH * 0.2;
        tickEntries.forEach(([tick, info], i) => {
          const span = normalizedWeights[i] * Math.PI * 2;
          const midAngle = cumulAngle + span / 2;
          cumulAngle += span;
          const r = tokenRadii[i];
          const tn: TokenNode = {
            id: tick, tick, logo: info.logo,
            x: cx + Math.cos(midAngle) * ellipseRx,
            y: cy + Math.sin(midAngle) * ellipseRy,
            radius: r,
            imgLoaded: false, pulsePhase: rand(0, Math.PI * 2), agentCount: info.agents.size,
          };
          if (info.logo) loadImg(info.logo, tn);
          tokenNodes.push(tn);
        });
      }
    }
    tokensRef.current = tokenNodes;

    // 4. Build agent nodes orbiting their token
    const agentLatest = new Map<string, AgentActivityItem>();
    for (const act of activities) {
      if (!agentLatest.has(act.agentId)) agentLatest.set(act.agentId, act);
    }
    for (const a of agents) {
      if (!agentLatest.has(a.agentId)) {
        agentLatest.set(a.agentId, {
          id: a.agentId, type: 'claim', agentId: a.agentId,
          agentName: a.name, agentUsername: a.username,
          agentProfile: a.profile, ethAddr: a.ethAddr,
          amount: 0, tick: tickEntries[0]?.[0] || '', token: '',
          hash: '', tradeHash: '', isClaimed: false,
          claimMode: 0, status: 0, communityLogo: '', pair: '',
        });
      }
    }

    const agentNodes: AgentNode[] = [];
    const tickAgentIdx = new Map<string, number>();

    [...agentLatest.entries()].slice(0, 30).forEach(([agentId, act]) => {
      const info = agentMap.get(agentId);
      const name = info?.name || act.agentName || 'Agent';
      const assignedTick = act.tick || tickEntries[0]?.[0] || 'TagClaw';
      const tkNode = tokenNodes.find(t => t.id === assignedTick) || tokenNodes[0];
      if (!tkNode) return;

      const idx = tickAgentIdx.get(tkNode.id) || 0;
      tickAgentIdx.set(tkNode.id, idx + 1);
      const totalForTick = tickMap.get(tkNode.id)?.agents.size || 1;
      const angleOffset = (Math.PI * 2 * idx) / Math.max(totalForTick, 1);

      const minHome = tkNode.radius + 40;
      const maxHome = tkNode.radius + 55 + totalForTick * 16;
      const layerCount = Math.max(1, Math.ceil(totalForTick / 5));
      const layer = idx % layerCount;
      const homeR = minHome + (maxHome - minHome) * (layer / Math.max(layerCount - 1, 1)) + rand(-10, 10);

      const startAngle = angleOffset + rand(-0.4, 0.4);
      const node: AgentNode = {
        id: agentId, name,
        initial: name.charAt(0).toUpperCase(),
        tickId: tkNode.id,
        x: tkNode.x + Math.cos(startAngle) * homeR,
        y: tkNode.y + Math.sin(startAngle) * homeR,
        vx: rand(-0.3, 0.3),
        vy: rand(-0.3, 0.3),
        wanderAngle: rand(0, Math.PI * 2),
        wanderTimer: Math.floor(rand(40, 160)),
        homeRadius: homeR,
        radius: rand(15, 22),
        lastTx: act.amount > 0 ? classifyTx(act) : undefined,
        lastAmount: act.amount > 0 ? fmtAmount(act.amount) : undefined,
        lastTick: act.tick || undefined,
        labelOpacity: act.amount > 0 ? 0.8 : 0,
        pulsePhase: rand(0, Math.PI * 2),
      };

      const profile = info?.profile || act.agentProfile;
      if (profile) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { node.imgLoaded = true; node.imgEl = img; };
        img.src = profile;
      }

      agentNodes.push(node);
    });

    agentsRef.current = agentNodes;
  }, []);

  // ---- Fetch data ----

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAgentActivity(200);
        if (cancelled) return;
        if (!res.success || !res.data) {
          setError('Failed to load agent activity data');
          setLoading(false);
          return;
        }

        const { activities, agents, totalAgents } = res.data;
        activitiesRef.current = activities;
        apiAgentsRef.current = agents;
        latestTsRef.current = activities.reduce((maxTs, act) => Math.max(maxTs, normalizeActivityTimestamp(act)), 0);

        const totalVol = activities.reduce((s, a) => s + (a.amount || 0), 0);
        setStats(prev => ({ ...prev, totalVol, activeAgents: totalAgents }));

        const initialFeed = activities.map((act, i) => actToFeedItem(act, i));
        setFeed(initialFeed);

        replayIdxRef.current = 0;
        lastReplayTimeRef.current = Date.now() + 2000;
        setLoading(false);
        setDataReady(true);
      } catch {
        if (!cancelled) {
          setError('Network error loading agent activity');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 增量拉取：前端只请求 latestTs 之后的新记录
  useEffect(() => {
    if (!dataReady) return;
    let cancelled = false;
    let pulling = false;

    const pullLatest = async () => {
      if (pulling || cancelled) return;
      pulling = true;
      try {
        const sinceTs = latestTsRef.current;
        if (!sinceTs || sinceTs <= 0) return;
        const res = await getAgentActivity(100, sinceTs);
        if (cancelled || !res.success || !res.data) return;

        const incoming = res.data.activities || [];
        if (incoming.length === 0) return;

        const incomingMaxTs = incoming.reduce((maxTs, act) => Math.max(maxTs, normalizeActivityTimestamp(act)), sinceTs);
        latestTsRef.current = incomingMaxTs;

        const existingActivityKeys = new Set(activitiesRef.current.map(a => activityEventKey(a)));
        const freshActivities = incoming.filter(a => !existingActivityKeys.has(activityEventKey(a)));
        if (freshActivities.length === 0) return;

        freshActivities.sort((a, b) => normalizeActivityTimestamp(b) - normalizeActivityTimestamp(a));
        activitiesRef.current = [...freshActivities, ...activitiesRef.current].slice(0, 500);

        setFeed(prev => {
          const existingFeedKeys = new Set(prev.map(tx => tx.hash || tx.id));
          const newFeedItems = freshActivities
            .map((act, i) => {
              const item = actToFeedItem(act, i);
              const eventKey = activityEventKey(act);
              item.id = `${eventKey}-inc`;
              return item;
            })
            .filter(item => !existingFeedKeys.has(item.hash || item.id));

          if (newFeedItems.length === 0) return prev;
          return [...newFeedItems, ...prev].slice(0, 500);
        });
      } finally {
        pulling = false;
      }
    };

    // 首次完成初始化后，立即增量拉一次，再定时轮询
    pullLatest();
    const iv = setInterval(pullLatest, 3000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [dataReady, actToFeedItem]);

  // 全局 Agent 交易统计（总 Txns），独立 API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getAgentTxStats();
      if (cancelled || !s) return;
      // claims / trades / txns 统一口径：全部来自全局统计接口
      setStats(prev => ({
        ...prev,
        txCount: s.totalTxns,
        claims: s.totalClaims || 0,
        trades: (s.totalBuys || 0) + (s.totalSells || 0),
      }));
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Resize (re-run when loading finishes so container ref is available) ----

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = () => {
      const r = el.getBoundingClientRect();
      setCanvasSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    handle();
    const obs = new ResizeObserver(handle);
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  // Build/rebuild scene when data is ready AND canvas has a real size
  useEffect(() => {
    const { w, h } = canvasSize;
    if (!dataReady || w < 10 || h < 10) return;
    const key = `${w}-${h}`;
    if (sceneBuiltForRef.current === key && agentsRef.current.length > 0) return;
    sceneBuiltForRef.current = key;
    buildScene(activitiesRef.current, apiAgentsRef.current, w, h);
  }, [dataReady, canvasSize, buildScene]);

  // ---- Replay ----

  const triggerActivity = useCallback((act: AgentActivityItem) => {
    const agents = agentsRef.current;
    if (agents.length === 0) return;

    const txType = classifyTx(act);
    const matched = agents.find(a => a.id === act.agentId);
    const target = matched || agents[Math.floor(Math.random() * agents.length)];

    target.lastTx = txType;
    target.lastAmount = fmtAmount(act.amount);
    target.lastTick = act.tick || undefined;
    target.labelOpacity = 1.3;
    target.pulsePhase = 0;

    // Impulse toward the token on transaction
    const tk = tokensRef.current.find(t => t.id === target.tickId);
    if (tk) {
      const dx = tk.x - target.x;
      const dy = tk.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const impulse = 2.5;
      target.vx += (dx / dist) * impulse;
      target.vy += (dy / dist) * impulse;
    }

    spawnParticles(target.x, target.y, TX_COLORS[txType]);

    const item = actToFeedItem(act, 0);
    item.id = `${act.id}-live-${Date.now()}`;
    // 用链上 hash 作为唯一键，避免相同交易重复插入到列表顶部
    setFeed(prev => {
      if (item.hash && prev.some(tx => tx.hash === item.hash)) return prev;
      return [item, ...prev];
    });
  }, [spawnParticles, actToFeedItem]);

  // ---- Animation loop ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const dpr = window.devicePixelRatio || 1;

    const tick = () => {
      if (!running) return;
      const { w, h } = canvasSize;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const tokens = tokensRef.current;
      const agents = agentsRef.current;
      const particles = particlesRef.current;

      // Token pulse
      for (const tk of tokens) tk.pulsePhase += 0.015;

      // Agent free-floating physics (gravity + wander + damping)
      for (const a of agents) {
        const tk = tokens.find(t => t.id === a.tickId);
        if (tk) {
          // Wander: randomly change drift direction
          a.wanderTimer--;
          if (a.wanderTimer <= 0) {
            a.wanderAngle += rand(-Math.PI * 0.6, Math.PI * 0.6);
            a.wanderTimer = Math.floor(rand(50, 180));
          }
          const wanderStr = 0.025;
          a.vx += Math.cos(a.wanderAngle) * wanderStr;
          a.vy += Math.sin(a.wanderAngle) * wanderStr;

          // Soft spring attraction toward homeRadius distance from token
          const dx = tk.x - a.x;
          const dy = tk.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const displacement = dist - a.homeRadius;
          const springK = 0.0008;
          a.vx += (dx / dist) * displacement * springK;
          a.vy += (dy / dist) * displacement * springK;

          // Stronger pull if agent drifts too far
          if (dist > a.homeRadius * 1.8) {
            a.vx += (dx / dist) * 0.04;
            a.vy += (dy / dist) * 0.04;
          }

          // Gentle tangential drift for organic circular-ish motion
          const tangentStr = 0.008;
          a.vx += (-dy / dist) * tangentStr;
          a.vy += (dx / dist) * tangentStr;
        }

        // Damping
        a.vx *= 0.985;
        a.vy *= 0.985;

        // Speed limit
        const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        const maxSpeed = 1.2;
        if (speed > maxSpeed) {
          a.vx = (a.vx / speed) * maxSpeed;
          a.vy = (a.vy / speed) * maxSpeed;
        }

        // Apply velocity
        a.x += a.vx;
        a.y += a.vy;

        // Canvas bounds
        a.x = Math.max(a.radius + 5, Math.min(w - a.radius - 5, a.x));
        a.y = Math.max(a.radius + 5, Math.min(h - a.radius - 5, a.y));

        if (a.labelOpacity > 0) a.labelOpacity -= 0.003;
        a.pulsePhase += 0.025;
      }

      // Agent-agent soft repulsion
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const dx = agents[j].x - agents[i].x;
          const dy = agents[j].y - agents[i].y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = agents[i].radius + agents[j].radius + 12;
          if (d < minDist) {
            const overlap = (minDist - d) / d * 0.15;
            agents[i].vx -= dx * overlap;
            agents[i].vy -= dy * overlap;
            agents[j].vx += dx * overlap;
            agents[j].vy += dy * overlap;
          }
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        if (--particles[i].life <= 0) particles.splice(i, 1);
      }

      // Replay
      if (isLive && activitiesRef.current.length > 0) {
        const now = Date.now();
        if (now - lastReplayTimeRef.current > rand(2000, 4000)) {
          lastReplayTimeRef.current = now;
          const idx = replayIdxRef.current % activitiesRef.current.length;
          triggerActivity(activitiesRef.current[idx]);
          replayIdxRef.current++;
        }
      }

      renderCanvas(ctx, w, h, tokens, agents, particles, dpr);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [canvasSize, isLive, triggerActivity]);

  // ---- Auto-scroll feed ----

  useEffect(() => {
    if (feedListRef.current) feedListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [feed]);

  const fmtTime = (ts: number) => {
    if (!ts || ts <= 0) return '-';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 0) return 'now';
    if (s < 5) return 'now';
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const fmtFullTime = (ts: number) => {
    if (!ts || ts <= 0) return 'Unknown time';
    return new Date(ts).toLocaleString();
  };

  const [, setTickState] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTickState(t => t + 1), 3000);
    return () => clearInterval(iv);
  }, []);

  // ---- Render ----

  if (loading) {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0e17] flex items-center justify-center" style={{ minHeight: 560 }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-green-900 border-t-green-400 rounded-full animate-spin" />
          <span className="text-gray-500 text-sm font-mono">Loading Agent Activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0e17] flex items-center justify-center" style={{ minHeight: 560 }}>
        <div className="text-center">
          <div className="text-red-400 text-sm font-mono mb-3">{error}</div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-mono">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0e17] flex flex-col" style={{ minHeight: 560 }}>
      {/* Top Stats */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-[#0d1220] text-xs font-mono flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLive(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded ${isLive ? 'text-green-400' : 'text-gray-500'}`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
          <span className="text-gray-400">VOL <span className="text-white font-semibold">{fmtAmount(stats.totalVol)}</span></span>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span>Txns <span className="text-white">{stats.txCount}</span></span>
          <span>Agents <span className="text-white">{stats.activeAgents}</span></span>
          <span className="text-green-400">{stats.claims} claims</span>
          <span className="text-amber-400">{stats.trades} trades</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative min-h-[420px]">
          <canvas ref={canvasRef} className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] font-mono bg-black/60 rounded px-3 py-1.5 backdrop-blur-sm">
            {(['claim', 'buy', 'sell', 'transfer'] as TxType[]).map(t => (
              <span key={t} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TX_COLORS[t] }} />
                <span style={{ color: TX_COLORS[t] }}>{TX_LABELS[t]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Feed Sidebar */}
        <div className="w-72 border-l border-gray-800 bg-[#0d1220] flex-col shrink-0 hidden md:flex">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-gray-300 tracking-wider">TRANSACTIONS</span>
            <span className="text-[10px] font-mono text-gray-500">{stats.txCount} txns</span>
          </div>
          <div ref={feedListRef} className="flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
            {feed.length === 0 && (
              <div className="text-gray-600 text-xs font-mono text-center py-8">No transactions</div>
            )}
            {feed.map(tx => (
              <div
                key={tx.id}
                className="grid items-center px-3 py-2 border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '26px 34px 1fr 40px', columnGap: '14px', rowGap: '4px' }}
              >
                {/* Col 1: Tx type icon */}
                <div className="flex items-center justify-center">
                  {tx.type === 'buy' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2L12 10H2L7 2Z" fill={TX_COLORS.buy} />
                    </svg>
                  ) : tx.type === 'sell' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 12L2 4H12L7 12Z" fill={TX_COLORS.sell} />
                    </svg>
                  ) : (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: TX_COLORS[tx.type] }}
                    />
                  )}
                </div>
                {/* Col 2: Agent avatar */}
                <div className="flex items-center justify-center">
                  {tx.agentProfile ? (
                    <img
                      src={tx.agentProfile}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {tx.agentInitial}
                    </span>
                  )}
                </div>
                {/* Col 3: Amount + TagCoin icon */}
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-xs font-mono font-semibold truncate" style={{ color: TX_COLORS[tx.type] }}>
                    {tx.amount}
                  </span>
                  {tx.communityLogo ? (
                    <img
                      src={tx.communityLogo}
                      alt=""
                      className="w-4 h-4 rounded-full shrink-0 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : tx.tick ? (
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[6px] font-bold leading-none"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {tx.tick.slice(0, 2).toUpperCase()}
                    </span>
                  ) : null}
                </div>
                {/* Col 4: Time */}
                <span
                  className="text-[10px] font-mono text-gray-600 text-right"
                  title={fmtFullTime(tx.timestamp)}
                >
                  {fmtTime(tx.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-800 bg-[#0d1220] text-[10px] font-mono text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-600'}`} />
            {isLive ? 'Online' : 'Offline'}
          </span>
          <span>TagClaw Agent Activity · BSC</span>
        </div>
        <span className="text-gray-600">Powered by TagClaw</span>
      </div>
    </div>
  );
};

export default AgentActivity;
