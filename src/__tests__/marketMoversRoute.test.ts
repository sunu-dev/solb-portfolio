import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/chokUniverse', () => ({
  CHOK_UNIVERSE: [{ symbol: 'AAPL', krName: '애플' }],
}));

vi.mock('@/config/koreanUniverse', () => ({
  KOREAN_UNIVERSE_DEDUPED: [{ symbol: '005930', krName: '삼성전자' }],
}));


describe('market movers quote routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('FINNHUB_API_KEY', 'test-finnhub-key');
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('uses Yahoo .KS/.KQ candidates for a bare Korean code and Finnhub only for US stocks', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('finnhub.io') && url.includes('AAPL')) {
        return new Response(JSON.stringify({ c: 210, pc: 200, d: 10, dp: 5 }), {
          status: 200,
        });
      }
      if (url.includes('005930.KS')) {
        return new Response(null, { status: 404 });
      }
      if (url.includes('005930.KQ')) {
        return new Response(JSON.stringify({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 220_000,
                chartPreviousClose: 150_000,
                previousClose: 200_000,
              },
            }],
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('@/app/api/market-movers/route');
    const response = await GET();
    const body = await response.json();
    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(response.status).toBe(200);
    expect(body.kr.gainers[0]).toMatchObject({
      symbol: '005930',
      currentPrice: 220_000,
      todayChange: 20_000,
      todayChangePct: 10,
    });
    expect(requestedUrls.some(url => url.includes('005930.KS'))).toBe(true);
    expect(requestedUrls.some(url => url.includes('005930.KQ'))).toBe(true);
    expect(requestedUrls.some(url =>
      url.includes('finnhub.io') && url.includes('005930'),
    )).toBe(false);
    expect(requestedUrls.some(url =>
      url.includes('finnhub.io') && url.includes('AAPL'),
    )).toBe(true);
  });

  it('shares one cold lookup among concurrent readers, then serves the existing TTL cache', async () => {
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const request = vi.fn(async (input: RequestInfo | URL) => {
      await ready;
      return String(input).includes('finnhub.io')
        ? Response.json({ c: 210, pc: 200, d: 10, dp: 5 })
        : Response.json({ chart: { result: [{ meta: { regularMarketPrice: 110000, previousClose: 100000 } }] } });
    });
    vi.stubGlobal('fetch', request);
    const { GET } = await import('@/app/api/market-movers/route');
    const responses = [GET(), GET(), GET()];
    expect(request).toHaveBeenCalledTimes(2); // one US and one Korean quote
    release();
    const bodies = await Promise.all(responses.map(async response => (await response).json()));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    expect(bodies[0].cached).toBe(false);
    expect((await (await GET()).json()).cached).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('finishes after the Finnhub deadline when that provider hangs, preserving Korean results', async () => {
    vi.useFakeTimers();
    const request = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('finnhub.io')) return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
      });
      return Promise.resolve(Response.json({ chart: { result: [{ meta: { regularMarketPrice: 110000, previousClose: 100000 } }] } }));
    });
    vi.stubGlobal('fetch', request);
    const { GET } = await import('@/app/api/market-movers/route');
    const response = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const body = await (await response).json();
    expect(body.ok).toBe(true);
    expect(body.us.gainers).toEqual([]);
    expect(body.kr.gainers[0].symbol).toBe('005930');
    const call = request.mock.calls.find(([input]) => String(input).includes('finnhub.io'));
    expect(call?.[1]?.signal?.aborted).toBe(true);
  });

});
