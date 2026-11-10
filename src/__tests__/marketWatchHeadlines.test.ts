import { describe, expect, it } from 'vitest';
import { presentWatchEvent, sortWatchEvents, type WatchEvent } from '@/lib/marketWatch';

const now = Date.parse('2026-10-25T07:00:00Z');
const news = (overrides: Partial<WatchEvent> = {}): WatchEvent => ({
  id: 'news:us:2026-10-24', kind: 'market-news', market: 'us',
  title: '미국 시장·정책 관련 소식', summary: '마이크로소프트 실적 발표를 앞두고 확인할 내용',
  meaning: '관련 배경', path: [], watch: '출처 확인', limits: '기사 제목 기준', sectors: [],
  sources: [{ label: '신문사', title: '마이크로소프트 실적 발표를 앞두고 확인할 내용',
    url: 'https://news.example/article?id=2', at: '2026-10-24T05:26:00Z' }],
  status: 'reported', priority: 35, asOf: '2026-10-24T05:26:00Z', fingerprint: 'article-2',
  firstSeenAt: '2026-10-24T05:30:00Z', updatedAt: '2026-10-24T05:30:00Z', lastObservedAt: '2026-10-25T06:50:00Z',
  history: [], ...overrides,
});

describe('headlines distinguish related-search records', () => {
  it('adapts existing publications immediately without changing their stored identity or evidence', () => {
    const original = news(); const before = structuredClone(original);
    const shown = presentWatchEvent(original);
    expect(shown).toMatchObject({ title: original.summary, summary: '', topic: '미국 시장·정책',
      id: original.id, sources: original.sources, firstSeenAt: original.firstSeenAt, asOf: original.asOf });
    expect(original).toEqual(before);
    expect(presentWatchEvent(shown)).toEqual(shown);
  });
  it('keeps different articles in the same market and puts newer publication evidence first', () => {
    const older = news({ id: 'news:us:2026-10-23', summary: '미 증시 3대 지수 하락 출발',
      asOf: '2026-10-23T13:33:00Z', priority: 51,
      sources: [{ label: '신문사', title: '미 증시 3대 지수 하락 출발', url: 'https://news.example/article?id=1', at: '2026-10-23T13:33:00Z' }] });
    const result = sortWatchEvents([older, news()], now);
    expect(result.map(item => item.id)).toEqual(['news:us:2026-10-24', 'news:us:2026-10-23']);
    expect(new Set(result.map(item => item.title)).size).toBe(2);
  });
  it('shows the same leading article once across daily records and tracking links', () => {
    const latest = news();
    const prior = news({ id: 'news:us:2026-10-23', asOf: '2026-10-23T13:33:00Z',
      sources: [{ ...latest.sources[0], url: `${latest.sources[0].url}&utm_source=rss` }] });
    expect(sortWatchEvents([prior, latest], now).map(item => item.id)).toEqual([latest.id]);
  });
  it('preserves article ID query parameters rather than merging different articles at one path', () => {
    const first = news();
    const second = news({ id: 'another', summary: '미국 시장의 다른 기사',
      sources: [{ label: '신문사', title: '미국 시장의 다른 기사', url: 'https://news.example/article?id=3', at: first.asOf }] });
    expect(sortWatchEvents([first, second], now)).toHaveLength(2);
  });
  it('preserves a recurring headline when it belongs to different articles on different days', () => {
    const latest = news({ summary: '미 증시 3대 지수 하락 출발' });
    const prior = news({ id: 'prior-day', summary: latest.summary, asOf: '2026-10-23T13:33:00Z',
      sources: [{ label: '신문사', title: latest.summary, url: 'https://news.example/article?id=1', at: '2026-10-23T13:33:00Z' }] });
    expect(sortWatchEvents([latest, prior], now)).toHaveLength(2);
  });
  it('does not collapse separate articles just because their headlines and publication times match', () => {
    const first = news();
    const second = news({ id: 'separate-article', sources: [{ ...first.sources[0], url: 'https://news.example/article?id=4' }] });
    expect(sortWatchEvents([first, second], now)).toHaveLength(2);
  });
  it('deduplicates repeated search snapshots without pretending a secondary-link change was an event update', () => {
    const event = news({ history: [
      { at: '2026-10-24T05:30:00Z', asOf: '2026-10-24T05:26:00Z', title: '미국 시장·정책 관련 소식', summary: '같은 기사 제목', status: 'reported' },
      { at: '2026-10-24T05:40:00Z', asOf: '2026-10-24T05:26:00Z', title: '미국 시장·정책 관련 소식', summary: '같은 기사 제목', status: 'reported' },
    ] });
    expect(presentWatchEvent(event).history).toHaveLength(1);
    expect(presentWatchEvent(event).history[0]).toMatchObject({ title: '같은 기사 제목', summary: '' });
  });
  it('preserves separate industry contexts and official market measures', () => {
    const first = news({ id: 'industry-a', kind: 'industry-news', sectors: ['technology'] });
    const second = news({ id: 'industry-b', kind: 'industry-news', sectors: ['semiconductors'] });
    const halt = news({ id: 'halt', kind: 'circuit-breaker', title: '코스피 거래 중단 공시', priority: 100, asOf: '2026-10-25T06:50:00Z' });
    expect(sortWatchEvents([first, second, halt], now)).toHaveLength(3);
    expect(sortWatchEvents([first, second, halt], now)[0]).toEqual(halt);
    expect(presentWatchEvent(halt)).toBe(halt);
  });
});
