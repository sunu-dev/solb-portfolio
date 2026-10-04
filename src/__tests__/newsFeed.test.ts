import { describe, expect, it, vi } from 'vitest';
import { createNewsClient, getNewsTargets, mergeRelatedNews, NEWS_STALE_MS, type NewsResponse } from '@/lib/newsFeed';

const article = { title: '새로운 기업 소식', link: 'https://example.com/article', source: '출처', pubDate: '2026-10-04T00:00:00Z', description: '' };
const success = (): Response => Response.json({ items: [article] });

describe('news requests', () => {
  it('shares one pending request across concurrent callers and revisits, preserving the fetch time', async () => {
    let finish!: (response: Response) => void;
    const request = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    let now = 100;
    const client = createNewsClient(request, () => now);
    const query = { q: '삼성전자 주가', locale: 'ko', maxHours: 48 };
    const first = client.load(query);
    const second = client.load(query);
    expect(first).toBe(second);
    expect(request).toHaveBeenCalledOnce();
    finish(success());
    expect((await first).result.status).toBe('ok');
    now = 1000;
    expect((await client.load(query)).fetchedAt).toBe(100);
    expect(request).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent forced refreshes and fetches expired results again', async () => {
    let now = 0;
    const request = vi.fn(async () => success());
    const client = createNewsClient(request, () => now);
    const query = { q: '애플 주가' };
    await client.load(query);
    await Promise.all([client.load(query, true), client.load(query, true)]);
    expect(request).toHaveBeenCalledTimes(2);
    now += NEWS_STALE_MS + 1;
    await client.load(query);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('caches a valid empty response but retries server/network failures', async () => {
    const request = vi.fn<typeof fetch>();
    request.mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json({ items: [] }));
    const client = createNewsClient(request);
    const query = { q: '새 회사 주가' };
    expect((await client.load(query)).result).toMatchObject({ status: 'error', reason: 'server' });
    expect((await client.load(query)).result).toMatchObject({ status: 'error', reason: 'network' });
    expect((await client.load(query)).result.status).toBe('empty');
    expect((await client.load(query)).result.status).toBe('empty');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('never supplies executable or malformed article links to the UI', async () => {
    const request = vi.fn(async () => Response.json({ items: [article, { ...article, link: 'javascript:alert(1)' }, { link: 'https://example.com' }] }));
    const client = createNewsClient(request);
    expect((await client.load({ q: '기업' })).result.items).toEqual([article]);
  });

  it('keeps the last successful list and timestamp available after a failed refresh', async () => {
    let now = 100;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(success()).mockResolvedValueOnce(new Response('', { status: 500 }));
    const client = createNewsClient(request, () => now);
    const query = { q: '기업' };
    await client.load(query);
    now = 200;
    expect((await client.load(query, true)).result.status).toBe('error');
    expect(client.peek(query)?.fetchedAt).toBe(100);
    expect(client.peek(query)?.result.items).toEqual([article]);
  });
});

describe('personal news coverage', () => {
  it('keeps all real holdings available, uses stored company names outside the static catalog, and deduplicates account holdings', () => {
    const targets = getNewsTargets([
      { symbol: 'AAPL', name: 'Apple Inc.' }, { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: '005930.KS' }, { symbol: 'ZZTEST', name: '새로운 회사' },
      { symbol: 'QQTEST' }, { symbol: ' ' },
    ]);
    expect(targets).toHaveLength(4);
    expect(targets.map(target => target.name)).toEqual(['애플', '삼성전자', '새로운 회사', 'QQTEST']);
    expect(targets[2].query).toBe('새로운 회사 주가');
  });

  it('merges one article found for two selected companies without inventing a held-stock claim', () => {
    const targets = getNewsTargets([{ symbol: 'AAPL' }, { symbol: 'MSFT' }]);
    const response: NewsResponse = { result: { status: 'ok', items: [article] }, fetchedAt: 100 };
    const result = mergeRelatedNews(targets.map(target => ({ target, response })));
    expect(result).toHaveLength(1);
    expect(result[0].relatedNames).toEqual(['애플', '마이크로소프트']);
    expect(result[0]).not.toHaveProperty('tag');
  });
});
