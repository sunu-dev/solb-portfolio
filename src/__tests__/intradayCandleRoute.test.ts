import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/candle/route';
vi.mock('@/lib/serverLogger', () => ({ logServerApi: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
const timestamp = Math.floor(Date.now() / 1000) - 300;
const result = { meta: { exchangeTimezoneName: 'America/New_York' }, timestamp: [timestamp], indicators: { quote: [{ open: [100], high: [102], low: [99], close: [101], volume: [123] }] } };
const response = () => Response.json({ chart: { result: [result] } });
describe('intraday candle API', () => {
  it('requests regular-session five-minute bars and returns bounded cache metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetcher);
    const responseData = await GET(new NextRequest('http://localhost/api/candle?symbol=MU&range=1d'));
    expect(fetcher.mock.calls[0][0]).toContain('range=5d&interval=5m&includePrePost=false');
    expect(await responseData.json()).toMatchObject({ s: 'ok', interval: '5m', asOf: timestamp, c: [101] });
    expect(responseData.headers.get('Cache-Control')).toContain('max-age=30');
  });
  it('keeps the existing daily endpoint contract for technical analysis', async () => {
    const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetcher);
    const data = await (await GET(new NextRequest('http://localhost/api/candle?symbol=MU'))).json();
    expect(fetcher.mock.calls[0][0]).toContain('range=1y&interval=1d');
    expect(data).toEqual({ s: 'ok', t: [timestamp], o: [100], h: [102], l: [99], c: [101], v: [123] });
  });
  it('falls back from KOSPI to KOSDAQ for bare Korean codes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ chart: { result: null } })).mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    expect((await GET(new NextRequest('http://localhost/api/candle?symbol=247540&range=1d'))).status).toBe(200);
    expect(fetcher.mock.calls.map(call => new URL(call[0]).pathname)).toEqual(['/v8/finance/chart/247540.KS', '/v8/finance/chart/247540.KQ']);
  });
  it('reports upstream failures separately from no data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 429 })));
    const failed = await GET(new NextRequest('http://localhost/api/candle?symbol=MU&range=1d'));
    expect(failed.status).toBe(500);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ chart: { result: [] } })));
    expect(await (await GET(new NextRequest('http://localhost/api/candle?symbol=MU&range=1d'))).json()).toEqual({ s: 'no_data' });
  });
});
