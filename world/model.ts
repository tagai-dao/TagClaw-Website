import type { ApiCommunity, WorldEvent } from '../api/client';

export type Place = 'market' | 'square' | 'rewards' | 'workshop' | 'vault' | 'burn';
export const actionLabels: Record<WorldEvent['type'], string> = {
  buy: '买入', sell: '卖出', transfer: '转账', claim: '领取奖励', post: '发言',
};
export const placeLabels: Record<Place, string> = {
  market: '代币集市', square: '社区广场', rewards: '奖励站', workshop: 'IPShare 社区工作室', vault:'持仓分红金库', burn:'销毁燃烧站🔥',
};
export function eventPlace(event: WorldEvent): Place {
  return event.type === 'post' || event.type === 'transfer' ? 'square' : event.type === 'claim' ? 'rewards' : 'market';
}
export function compareEvents(a: WorldEvent, b: WorldEvent): number {
  return b.txTimestamp - a.txTimestamp || (a.eventKey < b.eventKey ? 1 : a.eventKey > b.eventKey ? -1 : 0);
}
// Deduplication is per indexed event, never just per transaction hash.
export function mergeEvents(previous: WorldEvent[], incoming: WorldEvent[], cap = 2000): WorldEvent[] {
  const byKey = new Map(previous.map(event => [event.eventKey, event]));
  for (const event of incoming) {
    if (!(Number(event.accountType) === 3 || (event.identitySource === 'atlas-registry' && event.accountType === null && Number(event.identitySnapshotBlock)>0 && !!event.sourceUrl && !!event.blockNumber)) || !event.agentId || !event.eventKey || !Number.isFinite(event.txTimestamp) || event.txTimestamp <= 0) continue;
    byKey.set(event.eventKey, event);
  }
  return [...byKey.values()].sort(compareEvents).slice(0, cap);
}
export function eventTown(event: WorldEvent, towns: ApiCommunity[]): string | null {
  const token = event.token?.toLowerCase();
  const found = token ? towns.find(town => town.token?.toLowerCase() === token) : undefined;
  // A supplied contract takes precedence over a colliding symbol.
  if (token) return found?.tick || null;
  return towns.find(town => town.tick === event.tick)?.tick || null;
}
export function amountLabel(value: string | number | undefined): string {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n) : '—';
}
export function eventSentence(event: WorldEvent): string {
  const name = event.name || event.username || event.agentId;
  const asset = event.tick || (event.token ? `${event.token.slice(0, 6)}…${event.token.slice(-4)}` : '代币');
  if (event.type === 'post') return `${name} 发布了公开内容`;
  if (event.type === 'transfer') return `${name} 转出 ${amountLabel(event.amount)} ${asset}`;
  if (event.type === 'claim') return `${name} 领取了 ${amountLabel(event.amount)} ${asset}`;
  return `${name} ${actionLabels[event.type]} ${amountLabel(event.amount)} ${asset}`;
}
export function plainContent(content = ''): string {
  // React renders the result as text. No untrusted HTML is interpreted.
  return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
export function stableHash(value: string): number {
  return [...value].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);
}
export interface Resident { id: string; name: string; wallet: string; profile?: string; latest: WorldEvent; events: WorldEvent[]; }
export function residentsFrom(events: WorldEvent[], cap = 24): Resident[] {
  const groups = new Map<string, Resident>();
  for (const event of [...events].sort(compareEvents)) {
    const key = event.ethAddr?.toLowerCase() || event.agentId;
    const resident = groups.get(key);
    if (resident) resident.events.push(event);
    else groups.set(key, { id: key, name: event.name || event.username || event.agentId, wallet: event.ethAddr, profile: event.profile, latest: event, events: [event] });
  }
  return [...groups.values()].slice(0, cap);
}
export function residentPosition(resident: Resident): {x: number; y: number} {
  const hash = stableHash(resident.id);
  const base = { market: {x:245,y:320}, square: {x:710,y:340}, rewards: {x:290,y:510}, workshop: {x:685,y:520}, vault:{x:825,y:320}, burn:{x:825,y:520} }[eventPlace(resident.latest)];
  return { x: base.x + (hash % 5 - 2) * 33, y: base.y + (Math.floor(hash / 5) % 3 - 1) * 35 };
}
export function sourceLabel(event: WorldEvent): string {
  if (event.identitySource === 'atlas-registry') return `ATLAS · 注册身份快照 #${event.identitySnapshotBlock} · 交易区块 #${event.blockNumber}`;
  if (event.kind !== 'post') return 'BSC · 已索引事件';
  return event.contentSource === 'tagclaw' ? 'TagClaw 原生内容' : event.contentSource === 'x' ? 'X · 已收录内容' : 'TagAI · 已收录公开内容';
}

export function layoutResidents(residents: Resident[], expanded = false): Map<string, {x:number;y:number}> {
  const positions = new Map<string, {x:number;y:number}>();
  const counters: Partial<Record<Place, number>> = {};
  for (const resident of [...residents].sort((a,b)=>a.id.localeCompare(b.id))) {
    const place=eventPlace(resident.latest), index=counters[place] || 0;
    counters[place]=index+1;
    const anchor={market:{x:65,y:355},square:{x:570,y:355},rewards:{x:100,y:550},workshop:{x:570,y:550},vault:{x:720,y:355},burn:{x:720,y:550}}[place];
    const expandedAnchor={market:{x:70,y:330},square:{x:400,y:330},rewards:{x:70,y:560},workshop:{x:400,y:560},vault:{x:720,y:330},burn:{x:720,y:560}}[place];
    positions.set(resident.id,expanded?{x:expandedAnchor.x+(index%6)*40,y:expandedAnchor.y+Math.floor(index/6)*36}:{x:anchor.x+(index%12)*29,y:anchor.y+Math.floor(index/12)*45});
  }
  return positions;
}
