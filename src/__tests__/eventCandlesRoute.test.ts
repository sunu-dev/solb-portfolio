import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/apiRoute', () => ({ defineRoute: ({ handler }: { handler: (context: { req: NextRequest }) => Promise<Response> }) =>
  (req: NextRequest) => handler({ req }) }));
import { POST } from '@/app/api/event-candles/route';

const now = Date.parse('2026-10-22T10:00:00Z') / 1000;
const from = Date.parse('2026-10-19T00:00:00Z') / 1000;
const load = (body: unknown) => POST(new NextRequest('http://localhost/api/event-candles', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
}));
const chart = (t: number[], c: (number | null)[]) => Response.json({ chart: { result: [{ timestamp: t, indicators: { quote: [{ close: c }] } }] } });
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now * 1000));
  request = vi.fn(); vi.stubGlobal('fetch', request);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('historical price source contract', () => {
  it('does not cache HTTP or embedded provider failures as valid missing history', async () => {
    request.mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(Response.json({ chart: { result: null, error: { code: 'Too Many Requests' } } }));
    const response = await load({ symbols: ['AAPL', 'MSFT'], from, to: now - 86400 });
    expect(await response.json()).toEqual({ AAPL: { s: 'error' }, MSFT: { s: 'error' } });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('accepts a valid empty time series as no_data without inventing an IPO or baseline price', async () => {
    request.mockResolvedValue(chart([], []));
    expect(await (await load({ symbols: ['AAPL'], from })).json()).toEqual({ AAPL: { s: 'no_data' } });
  });
  it('excludes missing, nonpositive, out-of-window and future observations and requests a duplicate symbol once', async () => {
    request.mockResolvedValue(chart([from - 1, from, from + 86400, from + 172800, now + 3600], [10, 100, null, -1, 999]));
    const response = await load({ symbols: ['AAPL', 'AAPL'], from, to: now + 86400 });
    expect(await response.json()).toEqual({ AAPL: { s: 'ok', t: [from], c: [100] } });
    expect(request).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0][0])).toContain(`period2=${now}`);
  });
  it('rejects future-only windows before contacting a provider', async () => {
    expect((await load({ symbols: ['AAPL'], from: now + 86400, to: now + 172800 })).status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });
});
