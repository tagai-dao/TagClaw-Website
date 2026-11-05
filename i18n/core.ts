import messages from './messages.json';
export type Language = 'en' | 'zh';
export const languageKey = 'tagclaw.language';
function initialLanguage(): Language {
  try { const saved = localStorage.getItem(languageKey); if (saved === 'en' || saved === 'zh') return saved; } catch {}
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('zh') ? 'en' : 'zh';
}
let language: Language = initialLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => language === 'zh' ? 'zh-CN' : 'en-US';
export const subscribeLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLanguage(next: Language) {
  if (next !== 'en' && next !== 'zh') return;
  try { localStorage.setItem(languageKey, next); } catch {}
  language = next;
  if (typeof document !== 'undefined') document.documentElement.lang = getLocale();
  listeners.forEach(listener => listener());
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === languageKey && (event.newValue === 'en' || event.newValue === 'zh')) setLanguage(event.newValue);
});
type Pair = { en: string; zh: string };
const exact = new Map<string, Pair>();
const templates: { regex: RegExp; slots: number[]; pair: Pair }[] = [];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [key, pair] of Object.entries(messages)) {
  for (const text of [key, pair.en, pair.zh]) {
    if (!/\{\d+\}/.test(text)) { if (!exact.has(text)) exact.set(text, pair); continue; }
    const slots: number[] = []; let cursor = 0, pattern = '^';
    for (const match of text.matchAll(/\{(\d+)\}/g)) { pattern += escape(text.slice(cursor, match.index)) + '(.*?)'; slots.push(Number(match[1])); cursor = match.index! + match[0].length; }
    pattern += escape(text.slice(cursor)) + '$';
    templates.push({ regex: new RegExp(pattern, 's'), slots, pair });
  }
}
// Prefer specific sentence templates over short labels such as “View {0}”.
templates.sort((a,b) => b.regex.source.length - a.regex.source.length);
export function translateUI<T>(value: T): T {
  if (typeof value !== 'string' || !value.trim()) return value;
  const key = value.trim(), pair = exact.get(key);
  let translated = pair?.[language];
  if (translated == null) for (const template of templates) {
    const match = template.regex.exec(key); if (!match) continue;
    const args: Record<number, string> = {};
    template.slots.forEach((slot, i) => { args[slot] = template.pair.zh.startsWith('公开索引窗口：') ? (exact.get(match[i+1])?.[language] ?? match[i+1]) : match[i+1]; });
    translated = template.pair[language].replace(/\{(\d+)\}/g, (_,slot) => args[Number(slot)] ?? ''); break;
  }
  if (translated == null) return value;
  return (value.slice(0, value.indexOf(key)) + translated + value.slice(value.indexOf(key) + key.length)) as T;
}
