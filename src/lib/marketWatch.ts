import type { SectorId } from '@/lib/sectorExploration';
import type { MarketFlowBrief } from './marketFlowEngine';

export type WatchScope = 'market' | 'industries';
export type WatchStatus = 'observed' | 'monitoring' | 'halted' | 'resumed' | 'closed' | 'reported' | 'released' | 'publication';
export interface WatchSource { label: string; url: string; at: string; title?: string }
export interface WatchRevision { at: string; asOf: string; title: string; summary: string; status: WatchStatus }
export interface WatchEvent {
  id: string;
  kind: 'move' | 'circuit-breaker' | 'sidecar' | 'economic' | 'industry-news' | 'market-news';
  market: 'kr' | 'us' | 'global';
  title: string;
  topic?: string;
  summary: string;
  meaning: string;
  path: string[];
  watch: string;
  limits: string;
  sectors: SectorId[];
  sources: WatchSource[];
  status: WatchStatus;
  priority: number;
  asOf: string;
  fingerprint: string;
  firstSeenAt: string;
  updatedAt: string;
  lastObservedAt: string;
  history: WatchRevision[];
  relatedSymbols?: string[];
  measure?: { symbol: string; change: number; unit: '%' | '%포인트'; date: string };
  lastNotableAt?: string;
}
export interface WatchCoverage {
  id: string; label: string; available: number; total: number; checkedAt: string;
  lastSuccessAt?: string; failureSince?: string; consecutiveFailures?: number; lastAlertAt?: string;
  selected?: number;
}
export interface WatchRun {
  scope: WatchScope; checkedAt: string; coverage: WatchCoverage[]; warnings: string[];
}
export interface WatchFeed {
  events: WatchEvent[]; runs: WatchRun[]; servedAt: string;
  briefs?: MarketFlowBrief[];
  officialPolicies?: import('./marketCause/officialTypes').OfficialPolicyFeed;
}
export type WatchCandidate = Omit<WatchEvent, 'firstSeenAt' | 'updatedAt' | 'lastObservedAt' | 'history'>;

export function isWatchNews(event: Pick<WatchEvent, 'kind'>): boolean {
  return event.kind === 'market-news' || event.kind === 'industry-news';
}

/** Adapt previously stored category headings without rewriting historical publications. */
export function presentWatchEvent(event: WatchEvent): WatchEvent {
  if (!isWatchNews(event)) return event;
  const legacyTopic = event.title.match(/^(.+) 관련 소식$/)?.[1];
  const headline = (title: string, summary: string) => /^.+ 관련 소식$/.test(title) && summary.trim() ? summary.trim() : title;
  const title = headline(event.title, event.summary);
  const seen = new Set<string>();
  const history = event.history.flatMap(revision => {
    const heading = headline(revision.title, revision.summary);
    const key = `${revision.asOf}:${heading}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...revision, title: heading, summary: revision.summary.trim() === heading.trim() ? '' : revision.summary }];
  });
  return { ...event, title, topic: event.topic || legacyTopic || (event.market === 'kr' ? '한국 시장'
    : event.market === 'us' ? '미국 시장·정책' : '산업'),
    summary: event.summary.trim() === title.trim() ? '' : event.summary, history };
}

function newsArticleUrl(event: WatchEvent): string | undefined {
  const source = event.sources.find(item => item.title)?.url;
  if (!source) return;
  try {
    const url = new URL(source);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || url.hostname === 'news.google.com' && key === 'oc') url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return; }
}

/** A stable thread survives quiet periods, the next trading day, and a halt being lifted. */
export function mergeWatchEvent(candidate: WatchCandidate, previous: WatchEvent | undefined, now: string): WatchEvent {
  if (previous && Date.parse(candidate.asOf) < Date.parse(previous.asOf)) return previous;
  const changed = !previous || candidate.fingerprint !== previous.fingerprint;
  const lastNotableAt = candidate.priority >= 20 ? now : previous?.lastNotableAt;
  const recentNotable = lastNotableAt && Date.parse(now) - Date.parse(lastNotableAt) < 2 * 86400000;
  const monitoring = candidate.kind === 'move' && candidate.priority < 20 && recentNotable;
  const next = { ...candidate, ...(monitoring ? { priority: 10, status: 'monitoring' as const } : {}) };
  const revision: WatchRevision = { at: now, asOf: candidate.asOf, title: next.title, summary: next.summary, status: next.status };
  return {
    ...next, firstSeenAt: previous?.firstSeenAt ?? now,
    lastNotableAt,
    updatedAt: changed ? now : previous!.updatedAt, lastObservedAt: now,
    history: changed ? [...(previous?.history ?? []), revision].slice(-20) : previous!.history,
  };
}

export function watchRunStale(run: WatchRun, now: number): boolean {
  const limit = run.scope === 'market' ? 30 * 60000 : 150 * 60000;
  const time = Date.parse(run.checkedAt);
  return !Number.isFinite(time) || time > now + 60000 || now - time > limit;
}

/** A successful partial scan is never described as a quiet whole market. */
export function watchFeedState(feed: WatchFeed, now: number): 'ready' | 'partial' | 'stale' | 'pending' {
  const market = feed.runs.find(run => run.scope === 'market');
  if (!market) return 'pending';
  if (watchRunStale(market, now)) return 'stale';
  if (feed.runs.length < 2 || feed.runs.some(run => watchRunStale(run, now) || run.warnings.length
    || run.coverage.some(item => item.available < item.total))) return 'partial';
  return 'ready';
}

export function sortWatchEvents(events: WatchEvent[], now: number): WatchEvent[] {
  const sorted = events.filter(event => event.priority > 0 && Number.isFinite(Date.parse(event.asOf))
    && Date.parse(event.asOf) <= now + 60000 && now - Date.parse(event.asOf) < 7 * 86400000)
    .map(presentWatchEvent)
    .sort((a, b) => {
      // Old market measures remain a dated history, rather than dominating today's news.
      // Related-search bundles use publication recency, not the number of publishers, as their news order.
      const score = (event: WatchEvent) => (event.kind === 'market-news' ? 35 : event.kind === 'industry-news' ? 15 : event.priority)
        - Math.floor((now - Date.parse(event.asOf)) / 86400000) * 20;
      return score(b) - score(a) || Date.parse(b.asOf) - Date.parse(a.asOf)
        || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id);
    });
  const seen = new Set<string>();
  return sorted.filter(event => {
    if (!isWatchNews(event)) return true;
    // Keep separate editorial contexts (including industry filters), but show the
    // same leading article only once within each context across daily records.
    const context = `${event.kind}:${event.market}:${[...event.sectors].sort().join(',')}`;
    const title = `${context}:title:${event.asOf}:${event.title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()}`;
    const url = newsArticleUrl(event);
    const identity = url ? `${context}:url:${url}` : title;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
