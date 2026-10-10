import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/fundamentals/route';
vi.mock('@/lib/serverLogger', () => ({ logServerApi: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
const request = (symbol: string) => new NextRequest('http://localhost/api/fundamentals?symbol=' + symbol);

describe('fundamentals retains stored classification during provider outages', () => {
  it('returns industry evidence without inventing financial metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rate limited')));
    const { data } = await (await GET(request('PLTR'))).json();
    expect(data.classification.status).toBe('classified');
    expect(data.industry).toBeTruthy();
    expect(data.sector).toBe('정보기술');
    expect(data.per).toBeNull();
    expect(data.marketCap).toBeNull();
  });
  it('resolves a known Korean exchange and keeps unknown Korean codes in KRW', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('unavailable'));
    vi.stubGlobal('fetch', fetcher);
    const { data } = await (await GET(request('005930'))).json();
    expect(data.resolvedSymbol).toBe('005930.KS');
    expect(data.currency).toBe('KRW');
    expect(fetcher.mock.calls[0][0]).toContain('/005930.KS?');
    const unknown = await (await GET(request('999999'))).json();
    expect(unknown.data.currency).toBe('KRW');
    expect(unknown.data.classification.status).toBe('not-covered');
  });
  it('retains measured zeros and prefers sourced industry over conflicting Yahoo text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.includes('/chart/') ? { chart: { result: [{ meta: { currency: 'USD', marketCap: 123 } }] } }
        : { quoteSummary: { result: [{ summaryDetail: { trailingPE: { raw: 0 }, dividendYield: { raw: 0 } }, defaultKeyStatistics: { trailingEps: { raw: 0 } }, assetProfile: { industry: 'Wrong industry' } }] } }
    ))));
    const { data } = await (await GET(request('PLTR'))).json();
    expect(data.per).toBe(0); expect(data.eps).toBe(0); expect(data.dividendYield).toBe(0);
    expect(data.industry).not.toBe('Wrong industry');
    expect(data.marketCap).toBe(123);
    const conflict = await (await GET(request('MFIC'))).json();
    expect(conflict.data.industry).toBeNull();
    expect(conflict.data.classification.status).toBe('conflict');
  });
});
