import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
// These cases cover legacy sourced profiles while the engine store is healthy and has no publication.
vi.mock('@/lib/companyBusiness/store', () => ({ readPublishedBusiness: vi.fn(async () => ({ status: 'none' })) }));
import { GET } from '@/app/api/company-profile/route';
import { GET as retired } from '@/app/api/fundamentals/route';
afterEach(() => vi.unstubAllGlobals());
const request = (symbol: string) => new NextRequest('http://localhost/api/company-profile?symbol=' + symbol);

describe('company profile without financial data', () => {
  it('returns business coverage with sources, without new upstream calls', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const netflix = await (await GET(request('NFLX'))).json();
    expect(netflix.data.business.level).toBe('detailed');
    expect(netflix.data.business.summary).toContain('구독료');
    expect(netflix.data.business.sources).toHaveLength(2);
    const samsung = await (await GET(request('009150'))).json();
    expect(samsung.data.classification.name).toBe('삼성전기');
    expect(samsung.data.business.level).toBe('detailed');
    const unknown = await (await GET(request('UNKNOWN'))).json();
    expect(unknown.data.business).toEqual(expect.objectContaining({ symbol: 'UNKNOWN', level: 'missing', sources: [] }));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves sourced classification without calling an external financial provider', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { data } = await (await GET(request('PLTR'))).json();
    expect(data.classification.status).toBe('classified');
    expect(data.sector).toBe('정보기술');
    expect(data).not.toHaveProperty('per');
    expect(data).not.toHaveProperty('marketCap');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps exchange resolution, currency, unknown and conflicting classification', async () => {
    const { data } = await (await GET(request('005930'))).json();
    expect(data.resolvedSymbol).toBe('005930.KS'); expect(data.currency).toBe('KRW');
    const unknown = await (await GET(request('999999'))).json();
    expect(unknown.data.currency).toBe('KRW'); expect(unknown.data.classification.status).toBe('not-covered');
    const conflict = await (await GET(request('MFIC'))).json();
    expect(conflict.data.industry).toBeNull(); expect(conflict.data.classification.status).toBe('conflict');
  });
  it('rejects missing symbols and explicitly retires the old endpoint without caching', async () => {
    expect((await GET(request(''))).status).toBe(400);
    const result = await retired();
    expect(result.status).toBe(410); expect(result.headers.get('cache-control')).toBe('no-store');
  });
});
