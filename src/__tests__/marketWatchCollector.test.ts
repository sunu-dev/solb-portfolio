import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/economicFeed', () => ({ getEconomicFeed: async () => ({ events: [], checkedAt: new Date().toISOString(), warnings: [] }) }));
import { collectMarketWatch, relevantIndustryHeadline } from '@/lib/marketWatchCollector';
import { SECTORS } from '@/lib/sectorExploration';
import { WATCH_TARGETS } from '@/config/marketWatch';
const now = Date.parse('2026-10-15T04:00:00Z');
const feed = (builtAt = now, content = '') => `<rss><channel><lastBuildDate>${new Date(builtAt).toUTCString()}</lastBuildDate>${content}</channel></rss>`;
const request = (exchange: string, news = '') => vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('finance.yahoo')) return Response.json({ chart: { result: [{ meta: { regularMarketPrice: 100, previousClose: 101, regularMarketTime: now / 1000 } }] } });
  return new Response(url.includes('kind.krx.co.kr') ? exchange : feed(now, news));
});
afterEach(() => vi.restoreAllMocks());
describe('scheduled market source collection', () => {
  it('observes public bellwethers independently of any user holdings and links a company only to itself', async () => {
    const result = await collectMarketWatch('market', now, request(feed()));
    for (const symbol of ['INTC', 'AMZN', 'GOOGL']) {
      const event = result.candidates.find(item => item.measure?.symbol === symbol);
      expect(event?.relatedSymbols).toEqual([symbol]);
    }
  });
  it('does not treat a stale exchange feed as newly confirmed status', async () => {
    const result = await collectMarketWatch('market', now, request(feed(now - 31 * 60000)));
    expect(result.coverage.find(source => source.id === 'krx')?.available).toBe(0);
    expect(result.warnings.some(warning => warning.includes('거래소 공시'))).toBe(true);
  });
  it('requires a fresh channel build date instead of borrowing one from an item', async () => {
    const exchange = feed().replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/, '')
      .replace('</channel>', `<item><lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate></item></channel>`);
    const result = await collectMarketWatch('market', now, request(exchange));
    expect(result.coverage.find(source => source.id === 'krx')?.available).toBe(0);
  });
  it('accepts the actual empty KIND feed only with fresh uncached HTTP evidence and infers no market action', async () => {
    const base = request(feed());
    const empty = '<rss><channel><title>오늘의공시 :: </title></channel></rss>';
    const source = vi.fn(async (input: RequestInfo | URL) => String(input).includes('kind.krx.co.kr')
      ? new Response(empty, { headers: { Date: new Date(now).toUTCString() } }) : base(input));
    const result = await collectMarketWatch('market', now, source);
    expect(result.coverage.find(item => item.id === 'krx')?.available).toBe(1);
    expect(result.candidates.filter(item => ['circuit-breaker', 'sidecar'].includes(item.kind))).toEqual([]);
  });
  it.each([
    { Date: new Date(now - 120000).toUTCString() },
    { Date: new Date(now + 120000).toUTCString() },
    { Date: new Date(now).toUTCString(), Age: '300' }, {},
  ])('rejects unverified or cached empty exchange feeds: %j', responseHeaders => {
    const base = request(feed());
    const validHeaders = new Headers();
    for (const [key, value] of Object.entries(responseHeaders)) {
      if (typeof value === 'string') validHeaders.set(key, value);
    }
    return collectMarketWatch('market', now, vi.fn(async (input: RequestInfo | URL) => String(input).includes('kind.krx.co.kr')
      ? new Response('<rss><channel><title>오늘의공시 :: </title></channel></rss>', { headers: validHeaders }) : base(input)))
      .then(result => expect(result.coverage.find(item => item.id === 'krx')?.available).toBe(0));
  });
  it('refreshes the official feed URL while retaining the channel freshness check', async () => {
    const source = request(feed());
    const result = await collectMarketWatch('market', now, source);
    const call = source.mock.calls.find(([input]) => String(input).includes('kind.krx.co.kr'))!;
    expect(new URL(String(call[0])).searchParams.get('_checked')).toBe(String(Math.floor(now / 60000)));
    expect(result.coverage.find(item => item.id === 'krx')?.available).toBe(1);
  });
  it('uses only the official anonymous session when the public RSS requires one', async () => {
    const base = request(feed());
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const yahooAgents: Array<string | null> = [];
    const source = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const cookie = new Headers(init?.headers).get('Cookie');
      if (url.includes('finance.yahoo')) yahooAgents.push(new Headers(init?.headers).get('User-Agent'));
      if (url.includes('kind.krx.co.kr')) {
        calls.push({ url, cookie });
        if (url.includes('todaydisclosure.do')) return new Response('public page', { headers: { 'Set-Cookie': 'JSESSIONID=public-session; Path=/; HttpOnly' } });
        if (!cookie) return new Response('session required', { status: 403 });
      }
      return base(input);
    });
    const result = await collectMarketWatch('market', now, source);
    expect(result.coverage.find(item => item.id === 'krx')?.available).toBe(1);
    expect(calls).toHaveLength(3);
    expect(calls[2].cookie).toBe('JSESSIONID=public-session');
    expect(calls.every(call => new URL(call.url).hostname === 'kind.krx.co.kr')).toBe(true);
    expect(yahooAgents.every(agent => agent === 'Mozilla/5.0')).toBe(true);
  });
  it('retains unavailable status when the official site refuses both the feed and public page', async () => {
    const base = request(feed());
    const source = vi.fn(async (input: RequestInfo | URL) => String(input).includes('kind.krx.co.kr')
      ? new Response('denied', { status: 403 }) : base(input));
    const result = await collectMarketWatch('market', now, source);
    expect(result.coverage.find(item => item.id === 'krx')?.available).toBe(0);
    expect(source.mock.calls.filter(([input]) => String(input).includes('kind.krx.co.kr'))).toHaveLength(2);
  });
  it('recovers FX comparison using an explicit intraday previous close without skipping a missing daily bar', async () => {
    const base = request(feed());
    const source = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('KRW%3DX')) return Response.json({ chart: { result: [url.includes('interval=5m')
        ? { meta: { symbol: 'KRW=X', regularMarketPrice: 1326, previousClose: 1320, regularMarketTime: now / 1000 } }
        : { meta: { symbol: 'KRW=X', regularMarketPrice: 1326, regularMarketTime: now / 1000 }, indicators: { quote: [{ close: [1200, null, 1326] }] } }] } });
      return base(input);
    });
    const result = await collectMarketWatch('market', now, source);
    expect(result.coverage.find(item => item.id === 'quotes')?.available).toBe(WATCH_TARGETS.length);
    expect(result.candidates.find(item => item.measure?.symbol === 'KRW=X')?.measure?.change).toBe(0.45);
  });
  it.each(['missing-close', 'wrong-symbol', 'future'])('keeps invalid FX fallback unavailable: %s', failure => {
    const base = request(feed());
    const source = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('KRW%3DX')) return Response.json({ chart: { result: [{ meta: {
        symbol: failure === 'wrong-symbol' && url.includes('interval=5m') ? 'JPY=X' : 'KRW=X',
        regularMarketPrice: 1326,
        regularMarketTime: now / 1000 + (failure === 'future' ? 3600 : 0),
        ...(url.includes('interval=5m') && failure !== 'missing-close' ? { previousClose: 1320 } : {}),
      }, indicators: { quote: [{ close: [1200, null, 1326] }] } }] } });
      return base(input);
    });
    return collectMarketWatch('market', now, source).then(result => {
      expect(result.coverage.find(item => item.id === 'quotes')?.available).toBe(WATCH_TARGETS.length - 1);
      expect(result.candidates.find(item => item.measure?.symbol === 'KRW=X')).toBeUndefined();
    });
  });
  it('automatically scans the full current sector registry, including quantum and post-quantum security', async () => {
    const source = request(feed());
    const result = await collectMarketWatch('industries', now, source);
    expect(result.coverage[0]).toMatchObject({ available: SECTORS.length, total: SECTORS.length });
    expect(source).toHaveBeenCalledTimes(SECTORS.length);
    const queries = source.mock.calls.map(([input]) => decodeURIComponent(String(input)));
    expect(queries.some(query => query.includes('양자컴퓨팅'))).toBe(true);
    expect(queries.some(query => query.includes('양자내성암호'))).toBe(true);
    expect(result.candidates).toEqual([]); // successful empty searches are not fabricated stories
  });
  it('never upgrades a newspaper headline about a possible halt into a confirmed exchange measure', async () => {
    const news = `<item><title>코스피 서킷브레이커 발동 임박 - 신문사</title><link>https://news.google.com/articles/example</link><pubDate>${new Date(now).toUTCString()}</pubDate><source>신문사</source></item>`;
    const result = await collectMarketWatch('market', now, request(feed(), news));
    expect(result.candidates.filter(event => event.kind === 'circuit-breaker')).toEqual([]);
    expect(result.candidates.filter(event => event.kind === 'market-news').every(event => event.status === 'reported')).toBe(true);
  });
  it('publishes the actual lead headline with its market category stored separately', async () => {
    const title = '미국 증시 기업 실적 발표를 앞두고 변동';
    const news = `<item><title>${title} - 신문사</title><link>https://news.example/article/1</link><pubDate>${new Date(now).toUTCString()}</pubDate><source>신문사</source></item>`;
    const result = await collectMarketWatch('market', now, request(feed(), news));
    const articles = result.candidates.filter(item => item.kind === 'market-news');
    expect(articles).toHaveLength(2);
    expect(articles.every(item => item.title === title)).toBe(true);
    expect(articles.map(item => item.topic).sort()).toEqual(['미국 시장·정책', '한국 시장']);
  });
  it('retries a transient source failure once and counts the recovered request as available', async () => {
    const seen = new Set<string>();
    const source = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!seen.has(url)) { seen.add(url); return new Response('', { status: 503 }); }
      return new Response(feed());
    });
    const result = await collectMarketWatch('industries', now, source);
    expect(result.coverage[0].available).toBe(SECTORS.length);
    expect(source).toHaveBeenCalledTimes(SECTORS.length * 2);
  });
  it('does not repeat permanent rejected requests or mark their source coverage successful', async () => {
    const source = vi.fn(async () => new Response('', { status: 403 }));
    const result = await collectMarketWatch('industries', now, source);
    expect(result.coverage[0].available).toBe(0);
    expect(source).toHaveBeenCalledTimes(SECTORS.length);
    expect(result.candidates).toEqual([]);
  });
  it('honors a provider cooldown instead of immediately repeating rate-limited requests', async () => {
    const source = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
    const result = await collectMarketWatch('industries', now, source);
    expect(result.coverage[0].available).toBe(0);
    expect(source).toHaveBeenCalledTimes(SECTORS.length);
  });
});

describe('industry article relevance', () => {
  const energy = SECTORS.find(item => item.id === 'energy')!;
  it('excludes a local festival but retains concrete supply and price changes', () => {
    expect(relevantIndustryHeadline('광명시 기후주간 개막… 에너지 전환 모색', energy)).toBe(false);
    expect(relevantIndustryHeadline('원유 공급 차질에 유가 급등', energy)).toBe(true);
    expect(relevantIndustryHeadline('베트남 제약회사 경쟁력 강화', SECTORS.find(item => item.id === 'healthcare')!)).toBe(false);
  });
});
