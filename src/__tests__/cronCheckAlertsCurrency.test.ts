import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { StockItem } from '@/config/constants';

const dependencyMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: dependencyMocks.createClient,
}));

vi.mock('web-push', () => ({
  default: {
    sendNotification: dependencyMocks.sendNotification,
    setVapidDetails: dependencyMocks.setVapidDetails,
  },
}));

import { POST } from '@/app/api/cron/check-alerts/route';

interface AlertLogRow {
  alert_type: string;
  detail: string;
}

function makeDb(stock: StockItem, alertLogRows: AlertLogRow[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{
              user_id: 'user-1',
              subscription: { endpoint: 'https://push.example.test/subscription' },
              created_at: null,
            }],
          }),
        };
      }
      if (table === 'user_portfolios') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{
                user_id: 'user-1',
                stocks: { investing: [stock], watching: [], sold: [] },
              }],
            }),
          })),
        };
      }
      if (table === 'stock_listings') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [] }),
          })),
        };
      }
      if (table === 'sent_alerts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            })),
          })),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'alert_log') {
        return {
          insert: vi.fn((rows: AlertLogRow[]) => {
            alertLogRows.push(...rows);
            return Promise.resolve({ error: null });
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function quoteResponse(price: number): Response {
  return new Response(JSON.stringify({
    chart: { result: [{ meta: { regularMarketPrice: price } }] },
  }), { status: 200 });
}

async function runCron(stock: StockItem, fetchMock: ReturnType<typeof vi.fn>) {
  const alertLogRows: AlertLogRow[] = [];
  dependencyMocks.createClient.mockReturnValue(makeDb(stock, alertLogRows));
  dependencyMocks.sendNotification.mockResolvedValue({});
  vi.stubGlobal('fetch', fetchMock);

  const response = await POST(new NextRequest('http://localhost/api/cron/check-alerts', {
    method: 'POST',
    headers: { authorization: 'Bearer test-cron-secret' },
  }));

  expect(response.status).toBe(200);
  expect(dependencyMocks.sendNotification).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(
    dependencyMocks.sendNotification.mock.calls[0][1] as string,
  ) as { body: string };
  return { alertLogRows, payload };
}

describe('check-alerts currency reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  });

  it('resolves a bare Korean code through Yahoo candidates and formats native KRW prices', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('USDKRW=X')) return new Response(null, { status: 503 });
      if (url.includes('005930.KS')) return new Response(null, { status: 404 });
      if (url.includes('005930.KQ')) return quoteResponse(90_000);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { payload } = await runCron({
      symbol: '005930',
      currency: 'KRW',
      avgCost: 120_000,
      shares: 1,
      targetReturn: 0,
      stopLoss: 100_000,
    }, fetchMock);
    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(requestedUrls.some(url => url.includes('005930.KS'))).toBe(true);
    expect(requestedUrls.some(url => url.includes('005930.KQ'))).toBe(true);
    expect(payload.body).toBe('현재가 ₩90,000 ≤ 손절가 ₩100,000');
  });

  it('uses purchaseRate-aware cost for a USD holding KRW profit alert', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('USDKRW=X')) return quoteResponse(1_500);
      if (url.includes('/AAPL?')) return quoteResponse(110);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { alertLogRows, payload } = await runCron({
      symbol: 'AAPL',
      currency: 'USD',
      avgCost: 100,
      shares: 10,
      purchaseRate: 1_000,
      targetReturn: 0,
      targetProfitKRW: 500_000,
    }, fetchMock);

    expect(alertLogRows).toHaveLength(1);
    expect(alertLogRows[0].alert_type).toBe('target-profit-krw');
    expect(payload.body).toBe('현재 수익 ₩650,000');
  });

  it('skips only an FX-dependent profit alert when live FX is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('USDKRW=X')) return new Response(null, { status: 503 });
      if (url.includes('/AAPL?')) return quoteResponse(110);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { alertLogRows, payload } = await runCron({
      symbol: 'AAPL',
      currency: 'USD',
      avgCost: 100,
      shares: 10,
      purchaseRate: 900,
      targetReturn: 5,
      targetProfitKRW: 100_000,
    }, fetchMock);

    expect(alertLogRows.map(row => row.alert_type)).toEqual(['target-return']);
    expect(payload.body).toBe('수익률 10.0% ≥ 목표 5%');
    expect(consoleError).toHaveBeenCalledWith(
      '[cron/check-alerts] USD/KRW fetch !ok — FX-dependent alerts skipped',
    );
    consoleError.mockRestore();
  });
});
