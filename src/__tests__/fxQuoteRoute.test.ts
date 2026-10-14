import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Keep the public route wrapper; isolate external metering and quote providers.
vi.mock('@/lib/rateLimiter', () => ({
  POLICIES: { general: { windowSec: 60, maxLoggedIn: 120, maxAnon: 30 } },
  getClientIp: () => 'quote-contract-test',
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  recordApiCall: vi.fn(),
  rateLimitResponse: vi.fn(),
}));
vi.mock('@/lib/serverLogger', () => ({ logServerApi: vi.fn() }));

import { POST as batchQuote } from '@/app/api/quotes/route';
import { GET as individualQuote } from '@/app/api/kr-quote/route';

const missingPrevious = {
  meta: { regularMarketPrice: 1335.03, chartPreviousClose: 1339.08, currency: 'KRW' },
  indicators: { quote: [{ close: [1339.08, 1342.99, 1340.84, 1334.13, null, 1335.03] }] },
};
const yahooResponse = (result: unknown) => Response.json({ chart: { result: [result] } });
const batchRequest = () => new NextRequest('http://localhost/api/quotes', {
  method: 'POST', body: JSON.stringify({ symbols: ['^KS11', '^KQ11'], macro: true }),
});

beforeEach(() => vi.stubEnv('FINNHUB_API_KEY', 'test-key'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('FX quote API contracts', () => {
  it('returns the current FX rate and both Korean indices through the public batch route', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => yahooResponse(input.includes('USDKRW=X')
      ? missingPrevious : { meta: { regularMarketPrice: 6000, previousClose: 5900 } })));
    const response = await batchQuote(batchRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      usdKrw: { c: 1335.03, d: null, dp: null },
      quotes: { '^KS11': { c: 6000, pc: 5900 }, '^KQ11': { c: 6000, pc: 5900 } },
    });
  });

  it('returns the same usable FX quote through the individual fallback route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yahooResponse(missingPrevious)));
    const response = await individualQuote(new NextRequest('http://localhost/api/kr-quote?symbol=USDKRW=X'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ symbol: 'USDKRW=X', c: 1335.03, pc: null, d: null, dp: null });
  });

  it('does not substitute an older session as the previous close for Korean stocks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yahooResponse(missingPrevious)));
    expect((await individualQuote(new NextRequest('http://localhost/api/kr-quote?symbol=005930.KS'))).status).toBe(404);
  });

  it('preserves a confirmed unchanged FX rate as zero rather than unknown', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yahooResponse({ meta: { regularMarketPrice: 1335, previousClose: 1335 } })));
    const response = await individualQuote(new NextRequest('http://localhost/api/kr-quote?symbol=USDKRW=X'));
    expect(await response.json()).toMatchObject({ c: 1335, pc: 1335, d: 0, dp: 0 });
  });

  it('rejects a missing current rate on both API paths', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => yahooResponse({ meta: { previousClose: 1335 } })));
    expect((await individualQuote(new NextRequest('http://localhost/api/kr-quote?symbol=USDKRW=X'))).status).toBe(404);
    const batch = await batchQuote(batchRequest());
    expect((await batch.json()).usdKrw).toBeNull();
  });
});
