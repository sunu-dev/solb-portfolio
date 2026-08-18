import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/chokUniverse', () => ({
  CHOK_UNIVERSE: [{ symbol: 'AAPL', krName: '애플' }],
}));

vi.mock('@/config/koreanUniverse', () => ({
  KOREAN_UNIVERSE_DEDUPED: [{ symbol: '005930', krName: '삼성전자' }],
}));

import { GET } from '@/app/api/market-movers/route';

describe('market movers quote routing', () => {
  beforeEach(() => {
    process.env.FINNHUB_API_KEY = 'test-finnhub-key';
  });

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
                chartPreviousClose: 200_000,
              },
            }],
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

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
});
