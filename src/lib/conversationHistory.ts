import type { ConversationAnswer } from './joobiConversation';
import { parseJoobiPricePreview } from './joobiProgress';
export interface HistorySource { title: string; url: string }
export interface HistoryTurn { id: string; seq: number; context: string; createdAt: string; answer: ConversationAnswer }
const strings = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 12000);
const object = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
export function historySources(value: unknown): HistorySource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const s = object(item);
    if (!s || typeof s.url !== 'string' || typeof s.title !== 'string') return [];
    try { const u = new URL(s.url); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? [{ url: u.href, title: s.title.slice(0, 300) }] : []; } catch { return []; }
  }).slice(0, 20);
}
/** Only the visible reply, source links and its context; no quality receipt, raw articles or model metadata. */
export function historyAnswer(a: ConversationAnswer): ConversationAnswer {
  const prices = a.pricePreview ?? (a.assistantEvidence?.price ? {
    day: a.assistantEvidence.price.day, baselineDay: a.assistantEvidence.price.baselineDay,
    sessionState: a.assistantEvidence.price.sessionState,
    prices: [a.assistantEvidence.price, ...a.assistantEvidence.comparisons].slice(0, 4).map(p => ({ symbol: p.symbol, label: p.label, changePercent: p.changePercent })),
  } : undefined);
  return { turnId: a.turnId, historyId: a.historyId, createdAt: a.createdAt,
    question: a.question, symbol: a.symbol, market: a.market, period: a.period, local: a.local,
    currentStatus: a.currentStatus, keyAdvice: [...a.keyAdvice, ...(a.assistantInsights ?? []).map(i => i.text)],
    conclusion: { desc: a.conclusion.desc }, sessionReference: a.sessionReference, industryFocus: a.industryFocus,
    ...(prices ? { pricePreview: prices } : {}),
    savedSources: historySources(a.savedSources ?? [...(a.assistantEvidence?.evidence ?? []), ...(a._meta?.sourceDetails ?? []).map(s => ({ title: s.name, url: s.url }))]),
  };
}
export function parseHistoryTurn(value: unknown): HistoryTurn | null {
  const r = object(value), a = object(r?.answer), conclusion = object(a?.conclusion);
  if (!r || typeof r.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(r.id) || !Number.isSafeInteger(r.seq)
    || typeof r.context !== 'string' || r.context.length > 100 || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))
    || !a || typeof a.question !== 'string' || a.question.length > 600 || typeof a.symbol !== 'string' || a.symbol.length > 40
    || typeof a.currentStatus !== 'string' || a.currentStatus.length > 12000 || !strings(a.keyAdvice, 30)
    || !conclusion || typeof conclusion.desc !== 'string' || conclusion.desc.length > 12000) return null;
  const preview = parseJoobiPricePreview(a.pricePreview);
  return { id: r.id, seq: r.seq as number, context: r.context, createdAt: r.created_at,
    answer: { turnId: r.seq as number, historyId: r.id, createdAt: r.created_at, question: a.question, symbol: a.symbol,
      currentStatus: a.currentStatus, keyAdvice: a.keyAdvice as string[], conclusion: { desc: conclusion.desc }, local: a.local === true,
      ...(a.market === 'kr' || a.market === 'us' ? { market: a.market } : {}),
      ...(a.period === '1d' || a.period === '5d' || a.period === '1m' ? { period: a.period } : {}),
      ...(a.sessionReference === 'latest' || a.sessionReference === 'previous' ? { sessionReference: a.sessionReference } : {}),
      ...(preview ? { pricePreview: preview } : {}), savedSources: historySources(a.savedSources),
    } };
}
export function historyDayLabel(at: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const key = day(new Date(at));
  if (key === day(now)) return '오늘';
  if (key === day(new Date(now.getTime() - 86400000))) return '어제';
  return key;
}
