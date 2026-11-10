import { describe, expect, it } from 'vitest';
import { WATCH_TARGETS } from '@/config/marketWatch';
import { krxWatchEvents, parseWatchRss, quoteWatchEvent, sectorRotationEvent, type RssItem } from '@/lib/marketWatchAnalysis';
import { mergeWatchEvent, sortWatchEvents, watchFeedState, type WatchCandidate, type WatchFeed } from '@/lib/marketWatch';

const now = Date.parse('2026-10-15T04:00:00Z');
const kospi = WATCH_TARGETS.find(target => target.symbol === '^KS11')!;
const chart = (price = 920, previous: number | undefined = 1000) => ({ meta: { regularMarketPrice: price, previousClose: previous, regularMarketTime: now / 1000 } });
const notice = (title: string, at = '2026-10-15T03:38:00Z', receipt = '20261015000242'): RssItem => ({
  title, at, publisher: '유가증권시장', category: '시장조치',
  url: `http://kind.krx.co.kr:80/common/disclsviewer.do?method=searchInitInfo&acptNo=${receipt}&docno=`,
});
const event = () => quoteWatchEvent(kospi, chart(), now)!;

describe('official exchange measures', () => {
  it('reads the actual KIND RSS shape, decodes links, and retains the notice publication time', () => {
    const items = parseWatchRss(`<rss><channel><item><title><![CDATA[유가증권시장 매매거래 일시중단(1단계 CB 발동)]]></title><link><![CDATA[${notice('').url}]]></link><pubDate>Thu, 15 Oct 2026 12:38:00 +0900</pubDate><author>유가증권시장</author><category>시장조치</category></item></channel></rss>`, now);
    const result = krxWatchEvents(items, now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'halted', kind: 'circuit-breaker', asOf: '2026-10-15T03:38:00.000Z' });
    expect(result[0].sources[0].url).toBe('https://kind.krx.co.kr/common/disclsviewer.do?method=searchInitInfo&acptNo=20261015000242');
    expect(result[0].summary).toContain('공시 시각');
  });
  it('keeps halt and release in one dated thread regardless of feed order', () => {
    const result = krxWatchEvents([notice('유가증권시장 매매거래 재개(CB 해제)', '2026-10-15T03:58:00Z', '20261015000250'), notice('유가증권시장 매매거래 일시중단(1단계 CB 발동)')], now);
    expect(result).toHaveLength(1); expect(result[0].status).toBe('resumed');
    expect(result[0].sources.filter(source => source.title)).toHaveLength(2);
  });
  it('never infers release from 20 minutes passing', () => {
    expect(krxWatchEvents([notice('유가증권시장 매매거래 일시중단(1단계 CB 발동)')], now)[0].status).toBe('halted');
  });
  it('separates sidecar from a market-wide halt and preserves a third-stage closure', () => {
    const result = krxWatchEvents([notice('유가증권시장 매도 사이드카(Side car) 발동'), notice('유가증권시장 매매거래 종료(3단계 CB 발동)', '2026-10-15T03:50:00Z', '20261015000249')], now);
    expect(result.find(item => item.kind === 'sidecar')?.status).toBe('observed');
    expect(result.find(item => item.kind === 'circuit-breaker')?.status).toBe('closed');
  });
  it.each([
    { publisher: '파생상품시장', category: '파생상품시장공시' },
    { publisher: '신문사' }, { category: '기업공시' },
    { url: 'https://kind.krx.co.kr.evil.example/common/disclsviewer.do?acptNo=20261015000242' },
    { url: 'https://kind.krx.co.kr/common/disclsviewer.do?acptNo=20241015000242' },
    { title: '서킷브레이커 발동 임박' }, { title: '서킷브레이커 미발동 안내' },
    { title: '서킷브레이커 발동 조건 안내' }, { title: '서킷브레이커란 무엇인가' },
    { at: '2026-10-10T03:38:00Z' },
  ])('rejects non-confirmations and irrelevant markets: %j', overrides => {
    expect(krxWatchEvents([{ ...notice('유가증권시장 서킷브레이커 발동'), ...overrides }], now)).toEqual([]);
  });
  it('rejects a blocking page and excludes future-dated RSS articles', () => {
    expect(() => parseWatchRss('<html>access denied</html>', now)).toThrow();
    expect(parseWatchRss('<rss><channel><item><title>future</title><link>https://example.com</link><pubDate>Thu, 15 Oct 2026 19:38:00 +0900</pubDate></item></channel></rss>', now)).toEqual([]);
  });
});

describe('price observations are distinct from confirmed events', () => {
  it('does not claim a circuit breaker even when the index drops 8%', () => {
    expect(event()).toMatchObject({ kind: 'move', status: 'observed' });
    expect(event().title).toContain('-8.00%'); expect(event().title).not.toContain('발동');
  });
  it('observes rises and other industries with the same rules', () => {
    const target = WATCH_TARGETS.find(item => item.symbol === 'XLV')!;
    const result = quoteWatchEvent(target, chart(1040), now)!;
    expect(result.priority).toBeGreaterThan(20); expect(result.title).toContain('+4.00%');
    expect(result.limits).toContain('미국 ETF');
  });
  it('keeps quiet observations out of the main feed without fabricating a market conclusion', () => {
    const candidate = quoteWatchEvent(kospi, chart(1001), now)!;
    expect(candidate.priority).toBe(0);
    expect(sortWatchEvents([mergeWatchEvent(candidate, undefined, new Date(now).toISOString())], now)).toEqual([]);
  });
  it('does not substitute range-start close, skip missing previous candles, or accept stale/future prices', () => {
    expect(quoteWatchEvent(kospi, { meta: { regularMarketPrice: 1000, regularMarketTime: now / 1000 }, indicators: { quote: [{ close: [800, null, 1000] }] } }, now)).toBeNull();
    expect(quoteWatchEvent(kospi, { ...chart(), meta: { ...chart().meta, regularMarketTime: now / 1000 + 3600 } }, now)).toBeNull();
    expect(quoteWatchEvent(kospi, { ...chart(), meta: { ...chart().meta, regularMarketTime: now / 1000 - 8 * 86400 } }, now)).toBeNull();
  });
  it('uses percentage points for yields rather than a relative-percent headline', () => {
    const result = quoteWatchEvent(WATCH_TARGETS.find(item => item.kind === 'yield')!, chart(4.3, 4.1), now)!;
    expect(result.title).toContain('+0.20%포인트'); expect(result.title).not.toContain('4.88%');
    expect(quoteWatchEvent(WATCH_TARGETS.find(item => item.kind === 'yield')!, chart(4.3, 4.2), now)!.priority).toBeGreaterThan(0);
  });
  it('finds sector dispersion only with sufficient same-session evidence', () => {
    const candidates = WATCH_TARGETS.filter(item => item.kind === 'sector' && item.symbol !== 'SOXX').map((target, index) => quoteWatchEvent(target, chart(index === 0 ? 1040 : 990), now)!);
    expect(sectorRotationEvent(candidates)?.summary).toContain('11개');
    expect(sectorRotationEvent(candidates.slice(0, 7))).toBeNull();
    expect(sectorRotationEvent(candidates.map((item, index) => index < 4 ? { ...item, measure: { ...item.measure!, date: '2026-10-14' } } : item))).toBeNull();
  });
});

describe('publication and follow-up', () => {
  it('deduplicates repeat observations, tracks meaningful changes, and rejects an older overwrite', () => {
    const first = mergeWatchEvent(event(), undefined, new Date(now).toISOString());
    const repeat = mergeWatchEvent(event(), first, new Date(now + 600000).toISOString());
    expect(repeat.history).toHaveLength(1); expect(repeat.updatedAt).toBe(first.updatedAt);
    const changed = mergeWatchEvent(quoteWatchEvent(kospi, chart(900), now)!, repeat, new Date(now + 1200000).toISOString());
    expect(changed.history).toHaveLength(2);
    expect(mergeWatchEvent({ ...event(), asOf: '2026-10-14T00:00:00Z' }, changed, new Date(now + 1800000).toISOString())).toEqual(changed);
  });
  it('retains a recently notable thread after it falls below the observation threshold', () => {
    const first = mergeWatchEvent(event(), undefined, new Date(now).toISOString());
    const quiet = quoteWatchEvent(kospi, chart(999), now)!;
    expect(mergeWatchEvent(quiet, first, new Date(now + 600000).toISOString()).status).toBe('monitoring');
    expect(mergeWatchEvent(quiet, first, new Date(now + 3 * 86400000).toISOString()).priority).toBe(0);
  });
  it('never describes a failed or stale scan as a quiet complete market', () => {
    const base: WatchFeed = { events: [], servedAt: new Date(now).toISOString(), runs: [] };
    expect(watchFeedState(base, now)).toBe('pending');
    const run = { scope: 'market' as const, checkedAt: new Date(now).toISOString(), coverage: [{ id: 'quotes', label: '시세', available: 0, total: 20, checkedAt: new Date(now).toISOString() }], warnings: ['미확인'] };
    expect(watchFeedState({ ...base, runs: [run] }, now)).toBe('partial');
    expect(watchFeedState({ ...base, runs: [run] }, now + 31 * 60000)).toBe('stale');
  });
  it('bounds follow-up history while preserving the original publication time', () => {
    let saved = mergeWatchEvent(event(), undefined, new Date(now).toISOString());
    for (let index = 0; index < 30; index++) saved = mergeWatchEvent({ ...event(), fingerprint: String(index) } as WatchCandidate, saved, new Date(now + index * 60000).toISOString());
    expect(saved.history).toHaveLength(20); expect(saved.firstSeenAt).toBe(new Date(now).toISOString());
  });
  it('shows the latest exchange update first when important notices share a publication run', () => {
    const later = mergeWatchEvent({ ...event(), id: 'later', priority: 100, asOf: '2026-10-15T03:58:00Z' }, undefined, new Date(now).toISOString());
    const earlier = mergeWatchEvent({ ...event(), id: 'earlier', priority: 100, asOf: '2026-10-15T03:43:00Z' }, undefined, new Date(now).toISOString());
    expect(sortWatchEvents([earlier, later], now)[0].id).toBe('later');
  });
});
