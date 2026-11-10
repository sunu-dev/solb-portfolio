import { WATCH_TARGETS } from '@/config/marketWatch';
import type { WatchEvent, WatchRun } from './marketWatch';
import { VERIFIED_MARKET_FLOW_EVIDENCE } from './marketFlowEvidence';

export interface MarketFlowEvidence {
  id: string; market: 'kr' | 'us'; sessionDate: string; availableAfter: string;
  scope: 'market' | 'company'; symbols: string[]; title: string; fact: string; interpretation: string; next: string;
  sources: { role: 'company' | 'official' | 'reporting'; label: string; url: string }[];
}
export interface FlowMeasure {
  symbol: string; label: string; change: number; asOf: string; sourceUrl: string;
}
export interface MarketFlowBrief {
  id: string; market: 'kr' | 'us'; sessionDate: string; asOf: string; checkedAt: string | null;
  freshness: 'current' | 'delayed'; severity: 'large-move' | 'notable' | 'ordinary';
  pattern: 'decline' | 'advance' | 'mixed'; headline: string; summary: string;
  benchmarks: FlowMeasure[];
  breadth: { available: number; total: number; declining: number; advancing: number } | null;
  sectorExplanation: string | null; sectors: FlowMeasure[];
  companies: (FlowMeasure & { relativeToIndex: number })[];
  evidence: MarketFlowEvidence[]; explanationState: 'sourced' | 'awaiting-evidence';
  recentReleases: { title: string; at: string; summary: string; url: string }[];
  relatedNews: { title: string; at: string; url: string }[];
  nextChecks: string[]; limitations: string[];
  companyExplanations?: import('./marketCause/explanationEngine').LinkedCompanyExplanation[];
}
const DAY = 86400000;
const SECTOR_SYMBOLS = new Set(['XLK', 'XLC', 'XLY', 'XLP', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLRE', 'XLU']);
const targets = new Map(WATCH_TARGETS.map(target => [target.symbol, target]));
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const round = (value: number) => Math.round(value * 100) / 100;
function safeUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function sessionDay(at: number, market: 'kr' | 'us'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: market === 'us' ? 'America/New_York' : 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
function comparableTime(left: string, right: string, market: 'kr' | 'us'): boolean {
  if (Math.abs(Date.parse(left) - Date.parse(right)) <= 45 * 60000) return true;
  const minutes = (value: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: market === 'us' ? 'America/New_York' : 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    return Number(parts.find(part => part.type === 'hour')?.value) * 60 + Number(parts.find(part => part.type === 'minute')?.value);
  };
  // Regular-market fields can get a late vendor timestamp after the close.
  // This exception never licenses mixing a morning value with an afternoon one.
  const close = market === 'us' ? 16 * 60 : 15 * 60 + 30;
  return minutes(left) >= close && minutes(right) >= close;
}

/** Public observations only. Holdings, amounts and account IDs are deliberately
 * absent. Price co-movement is an observation, never a discovered cause.
 * Thresholds are editorial triage rules, not calibrated return predictions.
 */
export function buildMarketFlowBriefs(events: WatchEvent[], runs: WatchRun[], now: number,
  evidence: MarketFlowEvidence[] = VERIFIED_MARKET_FLOW_EVIDENCE): MarketFlowBrief[] {
  if (!Number.isFinite(now)) return [];
  const output: MarketFlowBrief[] = [];
  for (const market of ['kr', 'us'] as const) {
    const symbols = market === 'us' ? ['^GSPC', '^IXIC'] : ['^KS11', '^KQ11'];
    const bySymbol = new Map<string, WatchEvent>();
    const ambiguous = new Set<string>();
    for (const event of events) {
      const measure = event.measure; const time = Date.parse(event.asOf);
      if (event.kind !== 'move' || !['observed', 'monitoring'].includes(event.status) || event.market !== market || !measure || measure.unit !== '%'
        || !Number.isFinite(measure.change) || measure.change < -100 || measure.change > 1000
        || !Number.isFinite(time) || time > now + 60000 || now - time > 4 * DAY
        || measure.date !== sessionDay(time, market) || targets.get(measure.symbol)?.market !== market
        || !Array.isArray(event.sources)
        || !event.sources.some(source => safeUrl(source.url))) continue;
      const old = bySymbol.get(measure.symbol);
      if (!old || time > Date.parse(old.asOf)) {
        bySymbol.set(measure.symbol, event); ambiguous.delete(measure.symbol);
      } else if (time === Date.parse(old.asOf) && old.measure!.change !== measure.change) ambiguous.add(measure.symbol);
    }
    for (const symbol of ambiguous) bySymbol.delete(symbol);
    const indexEvents = symbols.map(symbol => bySymbol.get(symbol));
    // A missing or differently dated second index cannot support a broad claim.
    if (indexEvents.some(event => !event) || indexEvents[0]!.measure!.date !== indexEvents[1]!.measure!.date
      || !comparableTime(indexEvents[0]!.asOf, indexEvents[1]!.asOf, market)) continue;
    const sessionDate = indexEvents[0]!.measure!.date;
    const comparable = [...bySymbol.values()].filter(event => event.measure!.date === sessionDate
      && comparableTime(event.asOf, indexEvents[0]!.asOf, market));
    const toMeasure = (event: WatchEvent): FlowMeasure => ({ symbol: event.measure!.symbol,
      label: targets.get(event.measure!.symbol)!.label, change: event.measure!.change, asOf: event.asOf,
      sourceUrl: event.sources.find(source => safeUrl(source.url))!.url });
    const benchmarks = indexEvents.map(event => toMeasure(event!));
    const broad = benchmarks[0].change; const growth = benchmarks[1].change;
    const pattern = broad <= -0.3 && growth <= -0.3 ? 'decline' : broad >= 0.3 && growth >= 0.3 ? 'advance' : 'mixed';
    const severity = Math.abs(broad) >= 1.5 || Math.abs(growth) >= 2 ? 'large-move'
      : Math.abs(broad) >= 0.75 || Math.abs(growth) >= 1 ? 'notable' : 'ordinary';
    const sectorMoves = comparable.filter(event => SECTOR_SYMBOLS.has(event.measure!.symbol)).map(toMeasure);
    const breadth = market === 'us' ? { available: sectorMoves.length, total: 11,
      declining: sectorMoves.filter(item => item.change < 0).length, advancing: sectorMoves.filter(item => item.change > 0).length } : null;
    const widespread = !!breadth && breadth.available >= 8 && breadth.declining / breadth.available >= 0.75;
    const techLed = market === 'us' && pattern === 'decline' && growth - broad <= -0.75;
    const name = market === 'us' ? '미국' : '한국';
    const headline = pattern === 'decline'
      ? techLed ? '나스닥이 S&P 500보다 더 크게 내렸어요'
        : `${name} 주요 지수가 함께 내렸어요`
      : pattern === 'advance' ? `${name} 주요 지수가 함께 올랐어요`
        : Math.max(Math.abs(broad), Math.abs(growth)) < 0.3 ? `${name} 주요 지수의 변화가 크지 않아요`
          : `${name} 주요 지수의 등락 폭을 나눠서 봐야 해요`;
    let summary = `${benchmarks.map(item => `${item.label} ${signed(item.change)}`).join(', ')}예요.`;
    if (widespread) summary += ` 확인된 미국 업종 ETF ${breadth!.available}개 중 ${breadth!.declining}개가 내려 하락이 여러 업종에 걸쳤어요.`;
    else if (breadth && breadth.available >= 8) summary += ` 미국 업종 ETF ${breadth.available}개 중 ${breadth.declining}개 하락, ${breadth.advancing}개 상승으로 업종별 차이가 있어요.`;
    const sectors = [...sectorMoves].sort((a, b) => a.change - b.change);
    const low = sectors[0]; const high = sectors.at(-1);
    const sectorExplanation = sectors.length >= 8 && low && high ? `${low.label} ${signed(low.change)}, ${high.label} ${signed(high.change)}로 차이는 ${round(high.change - low.change).toFixed(2)}%포인트예요.${high.change < 0 ? ' 상대적으로 강한 쪽도 하락했어요.' : ''} 이 차이만으로 자금 이동을 단정하지 않아요.` : null;
    const companies = comparable.filter(event => targets.get(event.measure!.symbol)?.kind === 'company')
      .map(event => ({ ...toMeasure(event), relativeToIndex: round(event.measure!.change - broad) }))
      .filter(item => Math.abs(item.change) >= 5 || Math.abs(item.relativeToIndex) >= 4)
      .sort((a, b) => Math.abs(b.relativeToIndex) - Math.abs(a.relativeToIndex)).slice(0, 5);
    const selectedEvidence = evidence.filter(item => item.market === market && item.sessionDate === sessionDate
      && Number.isFinite(Date.parse(item.availableAfter)) && Date.parse(item.availableAfter) <= now
      && item.sources.length > 0 && item.sources.every(source => safeUrl(source.url))
      && item.sources.some(source => source.role === 'company' || source.role === 'official'));
    const observedAt = Math.max(...indexEvents.map(event => Date.parse(event!.asOf)));
    const releases = events.filter(event => event.kind === 'economic' && event.market === market && event.status === 'released'
      && Date.parse(event.asOf) <= observedAt && observedAt - Date.parse(event.asOf) <= 36 * 3600000)
      .flatMap(event => { const source = event.sources.find(item => safeUrl(item.url)); return source
        ? [{ title: event.title, at: event.asOf, summary: event.summary, url: source.url }] : []; }).slice(0, 3);
    const news = events.filter(event => event.kind === 'market-news' && event.market === market
      && Date.parse(event.asOf) <= now && Math.abs(Date.parse(event.asOf) - observedAt) <= 36 * 3600000)
      .flatMap(event => event.sources.filter(source => source.title && safeUrl(source.url)
        && Date.parse(source.at) <= now && Math.abs(Date.parse(source.at) - observedAt) <= 36 * 3600000)
        .map(source => ({ title: source.title!, at: source.at, url: source.url })));
    const run = runs.find(item => item.scope === 'market');
    const checked = run ? Date.parse(run.checkedAt) : NaN;
    const freshness = Number.isFinite(checked) && checked <= now + 60000 && now - checked <= 30 * 60000 ? 'current' : 'delayed';
    output.push({ id: `flow:${market}:${sessionDate}`, market, sessionDate, asOf: new Date(observedAt).toISOString(),
      checkedAt: Number.isFinite(checked) ? new Date(checked).toISOString() : null, freshness, severity, pattern, headline, summary,
      benchmarks, breadth, sectors, sectorExplanation, companies,
      evidence: selectedEvidence, explanationState: selectedEvidence.length ? 'sourced' : 'awaiting-evidence',
      recentReleases: releases, relatedNews: [...new Map(news.map(item => [item.url, item])).values()].slice(0, 3),
      nextChecks: [...new Set([...selectedEvidence.map(item => item.next),
        '다음 거래에서 일부 대형주만 움직이는지, 여러 업종이 함께 움직이는지 확인해요.',
        companies.length ? '지수보다 크게 움직인 회사는 실적·전망·공시를 따로 확인해요.' : '내 종목의 움직임을 같은 거래일의 시장 지수와 비교해요.'])].slice(0, 4),
      limitations: ['등락률은 전일 종가 대비이며 시세가 지연될 수 있어요. 장중·시간외 등락률과 섞지 않아요.',
        market === 'us' ? '업종 비교는 미국 ETF 표본이며 전체 종목의 상승·하락 비율이나 자금 유출입이 아니에요.' : '한국 지수와 미국 업종 ETF를 같은 시장의 표본으로 섞지 않아요.',
        '해석은 확인할 경로이며, 다음 주가 방향이나 매매 시점을 예측하지 않아요.',
        '지수와 종목의 등락률 차이는 비교값이에요. 시장 요인과 회사 요인이 각각 기여한 비율을 계산한 값은 아니에요.',
        ...(run?.warnings.length ? ['수집하지 못한 자료가 있어요. 확인 범위를 함께 살펴보세요.'] : [])],
    });
  }
  return output.sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf));
}
