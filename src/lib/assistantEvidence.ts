/** Public evidence contract. No account information or generated text is evidence. */
import type { AssistantSessionSelection } from './assistantSession';
import { usCalendarDay } from '@/config/usTradingCalendar';
import { getUsTradingSession } from '@/utils/usTradingSession';
export const ASSISTANT_PERIODS = ['1d', '5d', '1m'] as const;
export type AssistantPeriod = typeof ASSISTANT_PERIODS[number];
export const ASSISTANT_INDUSTRIES = ['semiconductors', 'technology'] as const;
export type AssistantIndustry = typeof ASSISTANT_INDUSTRIES[number];
export const ASSISTANT_INDUSTRY_BENCHMARKS: Record<AssistantIndustry, [string, string]> = {
  semiconductors: ['SOXX', '미국 반도체 기업을 담은 SOXX ETF'],
  technology: ['XLK', '미국 기술주를 담은 XLK ETF'],
};
export const ASSISTANT_PERIOD_LABELS: Record<AssistantPeriod, string> = { '1d': '최근 거래일', '5d': '최근 5거래일', '1m': '최근 20거래일' };
export interface AssistantEvidence {
  id: string; scope?: 'company' | 'industry' | 'market'; timing?: 'before-price' | 'after-price'; kind: 'price' | 'headline' | 'publication' | 'reference' | 'article'; title: string; text: string;
  url: string; publisher: string; publishedAt: string; checkedAt: string;
}
export interface PriceComparison {
  symbol: string; label: string; day: string; baselineDay: string; at: string;
  price: number; changePercent: number; currency: string; intradayLowChangePercent?: number; intradayHighChangePercent?: number;
  timeBasis?: 'retrieval';
  sessionState?: 'intraday' | 'closed' | 'unknown';
}
export interface AssistantEvidencePacket {
  version: 1; symbol: string; period: AssistantPeriod; checkedAt: string;
  price?: PriceComparison; comparisons: PriceComparison[];
  evidence: AssistantEvidence[]; gaps: string[];
  session?: AssistantSessionSelection;
  sessionUnavailable?: true;
  industryFocus?: AssistantIndustry[];
}
export interface AssistantInsight { kind: 'observation' | 'interpretation'; text: string; evidenceIds: string[] }
export function comparablePrices(target: PriceComparison, comparison: PriceComparison) {
  return target.day === comparison.day && target.baselineDay === comparison.baselineDay
    && target.currency === comparison.currency
    && (target.sessionState === 'closed' && comparison.sessionState === 'closed'
      || Math.abs(Date.parse(target.at) - Date.parse(comparison.at)) <= 30 * 60_000);
}

/** Unadjusted close-to-close prices; reject split windows instead of misreading splits as crashes. */
export function parseAssistantPrice(symbol: string, label: string, input: unknown, period: AssistantPeriod, now = Date.now(), throughDay?: string): PriceComparison | null {
  const result = (input as { chart?: { result?: Array<{
    meta?: { regularMarketTime?: number; regularMarketPrice?: number; currency?: string; exchangeTimezoneName?: string };
    timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[]; low?: (number | null)[]; high?: (number | null)[] }> };
    events?: { splits?: Record<string, { date?: number }> };
  }> } })?.chart?.result?.[0];
  const meta = result?.meta, times = result?.timestamp, closes = result?.indicators?.quote?.[0]?.close;
  const currency = meta?.currency || ({ '^GSPC': 'USD', '^IXIC': 'USD', '^KS11': 'KRW', '^KQ11': 'KRW' } as Record<string, string>)[symbol];
  if (!meta?.regularMarketTime || !currency || !meta.exchangeTimezoneName || !times || !closes || times.length !== closes.length) return null;
  const at = meta.regularMarketTime * 1000;
  if (at > now + 60_000 || now - at > 7 * 86400_000) return null;
  const date = (seconds: number) => new Intl.DateTimeFormat('en-CA', { timeZone: meta.exchangeTimezoneName, year: 'numeric', month: '2-digit', day: '2-digit' }).format(seconds * 1000);
  try {
    if (times.some((t, i) => !Number.isFinite(t) || t * 1000 > now + 60_000 || i > 0 && t <= times[i - 1])) return null;
    const rows = times.map((t, i) => ({ t, c: closes[i], index: i }));
    if (!rows.length || date(rows.at(-1)!.t) !== date(meta.regularMarketTime)) return null;
    // 한국 장 마감 뒤 자정 무렵에는 마지막 일봉의 종가가 비어서 오는 일이 있다. 같은 거래일의
    // 마지막 체결가(regularMarketPrice)가 있으면 그 값으로 채운다. 다른 날의 가격으로 대신하지 않는다.
    const lastRow = rows.at(-1)!;
    if (lastRow.c == null && typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0) lastRow.c = meta.regularMarketPrice;
    if (throughDay !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(throughDay) || !Number.isFinite(Date.parse(throughDay)) || new Date(throughDay).toISOString().slice(0, 10) !== throughDay)) return null;
    const selected = throughDay ? rows.filter(row => date(row.t) <= throughDay) : rows;
    const count = period === '1d' ? 1 : period === '5d' ? 5 : 20;
    if (selected.length <= count) return null;
    const window = selected.slice(-count - 1), first = window[0], last = window.at(-1)!;
    if (now - last.t * 1000 > 7 * 86400_000) return null;
    if (window.some(r => typeof r.c !== 'number' || !Number.isFinite(r.c) || r.c <= 0)) return null;
    // Missing sessions/suspended quotes cannot silently stretch a short comparison into months.
    if (window.some((r, i) => i > 0 && r.t - window[i - 1].t > 7 * 86400)) return null;
    if (new Set(window.map(r => date(r.t))).size !== window.length) return null;
    if (Object.values(result?.events?.splits ?? {}).some(s => !s.date || date(s.date) > date(first.t) && date(s.date) <= date(last.t))) return null;
    // A missing split event is not proof of a real collapse. Quarantine extreme
    // daily discontinuities until independently verified, even inside a longer window.
    if (window.some((r, i) => i > 0 && (r.c! / window[i - 1].c! < 0.5 || r.c! / window[i - 1].c! > 2))) return null;
    const priorClose = rows[last.index - 1]?.c;
    const low = result?.indicators?.quote?.[0]?.low?.[last.index], high = result?.indicators?.quote?.[0]?.high?.[last.index];
    const range = typeof low === 'number' && Number.isFinite(low) && low > 0 && typeof high === 'number' && Number.isFinite(high) && high >= low && last.c! >= low && last.c! <= high && typeof priorClose === 'number' && priorClose > 0
      ? { intradayLowChangePercent: Number(((low / priorClose - 1) * 100).toFixed(2)), intradayHighChangePercent: Number(((high / priorClose - 1) * 100).toFixed(2)) } : {};
    const selectedDay = date(last.t);
    const usSession = meta.exchangeTimezoneName === 'America/New_York' ? getUsTradingSession(new Date(at)) : undefined;
    const calendar = usCalendarDay(selectedDay);
    // The latest daily bar can still be forming. A post-close fetch does not
    // turn a delayed intraday quote into a confirmed closing price.
    // 한국 정규장은 15:30에 끝난다. 마지막 체결이 그 시각 이후거나 그날 18시가 지났으면 마감으로 본다
    // (개장이 늦춰지는 날에도 장중을 마감으로 부르지 않기 위한 여유).
    const krClose = meta.exchangeTimezoneName === 'Asia/Seoul' ? Date.parse(`${selectedDay}T15:30:00+09:00`) : undefined;
    const sessionState = krClose !== undefined
      ? at >= krClose || now >= krClose + 150 * 60_000 ? 'closed' : now >= Date.parse(`${selectedDay}T09:00:00+09:00`) ? 'intraday' : 'unknown'
      : usSession && calendar.known && !calendar.holiday
      ? selectedDay < date(meta.regularMarketTime) || usSession.phase === 'post' ? 'closed' : usSession.phase === 'open' ? 'intraday' : 'unknown'
      : 'unknown';
    return { ...range, sessionState, ...(throughDay ? { timeBasis: 'retrieval' as const } : {}), symbol, label, day: selectedDay, baselineDay: date(first.t), at: new Date(throughDay ? now : at).toISOString(), price: last.c!,
      changePercent: Number(((last.c! / first.c! - 1) * 100).toFixed(2)), currency };
  } catch { return null; }
}
export function validateAssistantInsights(value: unknown, packet?: AssistantEvidencePacket): value is AssistantInsight[] {
  if (!Array.isArray(value) || value.length > 3) return false;
  return value.every(item => item && ['observation', 'interpretation'].includes(item.kind)
    && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 350
    && Array.isArray(item.evidenceIds) && item.evidenceIds.length >= 1 && item.evidenceIds.length <= 3
    && new Set(item.evidenceIds).size === item.evidenceIds.length
    && item.evidenceIds.every((id: unknown) => typeof id === 'string' && packet?.evidence.some(e => e.id === id)));
}

/** Reject the observed sign inversion and invented percentage figures; this is not universal fact verification. */
export function assistantPriceClaimIssue(report: Record<string, unknown>, packet?: AssistantEvidencePacket) {
  const texts = [report.currentStatus, ...(Array.isArray(report.keyAdvice) ? report.keyAdvice : []),
    ...(Array.isArray(report.assistantInsights) ? report.assistantInsights.map(item => item?.text) : [])].filter((v): v is string => typeof v === 'string');
  if (texts.some(text => /\b[APNMDFR]\d+\b/.test(text))) return 'unknown_evidence_id';
  if (!packet?.price) return undefined;
  if (packet.price.sessionState === 'intraday' && texts.some(text => /(?:상승|하락|보합)\s*마감(?:했|한|하|이|으로)|마감\s*기준(?:으로|으론)?\s*(?:올|오|내|떨|하락|상승|[+-]?\d)/.test(text))) return 'intraday_described_as_close';
  const prices = [packet.price, ...packet.comparisons];
  // Restrict "only X fell" to the compared subjects. A generic Korean word
  // ending in 만 also matched conjunctions such as "다만" and "하지만".
  const subjectNames = [...new Set(prices.flatMap(price => [price.symbol, price.label, price.label.split(/[\s(]/)[0]]))]
    .filter(Boolean).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const onlySubject = new RegExp(`(?:이\\s*(?:회사|종목)|해당\\s*종목|(?<![가-힣A-Za-z0-9])(?:${subjectNames.join('|')}))만(?![의큼]).{0,12}(?:떨어|하락|내려|급락)`);
  if (packet.price.changePercent < 0 && packet.comparisons.some(price => price.changePercent < 0)
    && texts.some(text => onlySubject.test(text) && !/(?:떨어진|하락한|내려간|급락한)\s*(?:것은|것이|건)?\s*(?:아니|아닙)/.test(text))) return 'unsupported_exclusive_decline';
  const values = prices.flatMap(q => [q.changePercent, q.intradayLowChangePercent, q.intradayHighChangePercent]).filter((n): n is number => typeof n === 'number');
  for (const text of texts) {
    if (/^(?:예를 들어|가령|가상 예|가정한 예)/.test(text)) continue;
    for (const match of text.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%(?!포인트)([^.!?。%]{0,16})/g)) {
      const number = Number(match[1]), tail = match[2];
      const precision = match[1].split('.')[1]?.length ?? 0;
      const candidates = values.filter(v => Math.abs(Number(Math.abs(v).toFixed(precision)) - Math.abs(number)) < .000001);
      // Headline figures are reported claims, not verified quotes; do not invent absent percentages.
      if (!candidates.length) {
        if (!packet.evidence.some(e => e.kind !== 'price' && `${e.title} ${e.text}`.includes(match[1] + '%'))) return 'unverified_percentage';
        continue;
      }
      if ((/^\s*(?:까지\s*)?(?:하락|내려|내렸|낮|떨어|빠졌)/.test(tail) || match[1].startsWith('-')) && candidates.every(n => n > 0)) return 'inverted_decline';
      if ((/^\s*(?:까지\s*)?(?:상승|올라|올랐|높)/.test(tail) || match[1].startsWith('+')) && candidates.every(n => n < 0)) return 'inverted_rise';
    }
  }
  return undefined;
}

export function assistantPriceClaimsMatch(report: Record<string, unknown>, packet?: AssistantEvidencePacket) {
  return assistantPriceClaimIssue(report, packet) === undefined;
}

/** Catch the observed midterm-to-presidential-election substitution; this is not a general fact checker. */
export function assistantElectionClaimsMatch(report: Record<string, unknown>, packet?: AssistantEvidencePacket) {
  if (!packet) return true;
  const source = packet.evidence.filter(e => e.kind === 'article').map(e => `${e.title} ${e.text}`).join(' ');
  const midterm = /중간\s*선거|midterm/i.test(source);
  const presidential = /대통령\s*선거|대선|presidential\s*election/i;
  if (!midterm || presidential.test(source)) return true;
  const text = [report.currentStatus, ...(Array.isArray(report.keyAdvice) ? report.keyAdvice : []),
    ...(Array.isArray(report.assistantInsights) ? report.assistantInsights.map(item => item?.text) : [])].filter(value => typeof value === 'string').join(' ');
  return !presidential.test(text);
}

/** Validate explicit money amounts against supplied sources, without inventing an exchange rate. */
export function assistantMoneyClaimsMatch(report: Record<string, unknown>, packet?: AssistantEvidencePacket) {
  if (!packet) return true;
  const money = (text: string) => {
    const values: Array<{ currency: string; amount: number }> = [];
    const pattern = /(?:(US\$|\$|USD|KRW|₩)\s*)?(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|bn|조|억|만|천)?\s*(달러|원|USD|KRW|dollars?)?/gi;
    const factors: Record<string, number> = { trillion: 1e12, billion: 1e9, million: 1e6, bn: 1e9, 조: 1e12, 억: 1e8, 만: 1e4, 천: 1e3 };
    // "3조4000억원"은 하나의 금액이다. 조와 억을 따로 읽으면 같은 값을 "3.4조 원"으로 쓴 답을 틀렸다고 거절한다.
    text = text.replace(/(\d[\d,]*(?:\.\d+)?)\s*조\s*(\d[\d,]*(?:\.\d+)?)\s*억\s*(달러|원)/g, (_, trillions: string, hundredMillions: string, unit: string) => {
      values.push({ currency: unit === '원' ? 'KRW' : 'USD', amount: Number(trillions.replaceAll(',', '')) * 1e12 + Number(hundredMillions.replaceAll(',', '')) * 1e8 });
      return ' ';
    });
    for (const match of text.matchAll(pattern)) {
      const unit = match[1] || match[4];
      if (!unit) continue;
      values.push({ currency: /KRW|₩|원/i.test(unit) ? 'KRW' : 'USD', amount: Number(match[2].replaceAll(',', '')) * (factors[match[3]?.toLowerCase()] ?? 1) });
    }
    return values;
  };
  const sourceAmounts = packet.evidence.filter(e => e.kind !== 'headline').flatMap(e => money(e.title + '\n' + e.text));
  for (const price of [packet.price, ...packet.comparisons]) if (price) sourceAmounts.push({ currency: price.currency, amount: price.price });
  const texts = [report.currentStatus, ...(Array.isArray(report.keyAdvice) ? report.keyAdvice : []),
    ...(Array.isArray(report.assistantInsights) ? report.assistantInsights.map(item => item?.text) : [])].filter((value): value is string => typeof value === 'string');
  return texts.every(text => /^(?:예를 들어|가령|가상 예|가정한 예)/.test(text) || money(text).every(claim => sourceAmounts.some(source => source.currency === claim.currency && Math.abs(source.amount - claim.amount) <= Math.max(0.01, Math.abs(source.amount) * 0.000001))));
}

/** Evidence IDs are for links only. Strip known IDs from prose without changing the cited facts. */
export function cleanAssistantAnswer(report: Record<string, unknown>, packet?: AssistantEvidencePacket): Record<string, unknown> {
  const ids = new Set(packet?.evidence.map(e => e.id) ?? []);
  const clean = (value: unknown) => typeof value === 'string' ? value.replace(/\b[APNMDFR]\d+\b\s*/g, id => ids.has(id.trim()) ? '' : id).replace(/\(\s*\)|\[\s*\]/g, '').trim() : value;
  return { ...report, currentStatus: clean(report.currentStatus),
    keyAdvice: Array.isArray(report.keyAdvice) ? report.keyAdvice.map(clean) : report.keyAdvice,
    assistantInsights: Array.isArray(report.assistantInsights) ? report.assistantInsights.map(item => ({ ...item, text: clean(item.text) })) : report.assistantInsights,
    followUps: Array.isArray(report.followUps) ? report.followUps.map(clean) : report.followUps };
}


/** Suggested questions must stay inside the available source capabilities. Filling a button never calls a model. */
export function assistantFollowUps(suggestions: string[]): string[] {
  const unsupported = /시간대|몇\s*시|정확한\s*(?:시간|시각)|다른\s*(?:대형\s*)?회사.*(?:움직|올랐|하락)|날짜.*알려주|과거.*(?:조회|찾아)/;
  const usable = suggestions.filter(q => !unsupported.test(q));
  const fallback = ['같은 소식도 회사마다 주가에 다른 영향을 줄 수 있나요?', '전날 종가와 장중 고점 중 무엇과 비교하느냐에 따라 등락이 달라지나요?'];
  return [...new Set([...usable, ...fallback])].slice(0, 2);
}
