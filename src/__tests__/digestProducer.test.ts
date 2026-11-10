import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ db: {} as Record<string, unknown>, queue: vi.fn(), process: vi.fn(), alert: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: () => mocks.db }));
vi.mock('@/lib/digestDelivery', () => ({ queueDigest: mocks.queue, processDigestQueue: mocks.process }));
vi.mock('@/lib/cronAlert', () => ({ sendCronAlert: mocks.alert }));
vi.mock('@/lib/moverNote', () => ({ buildMoverNote: async () => null }));
vi.mock('@/lib/apiRoute', () => ({ defineRoute: () => vi.fn() }));
import { runDigest } from '@/app/api/cron/morning-brief/route';

it('stops personalized digest generation before database or quote access during cutover', async () => {
  vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', 'on');
  mocks.db = {};
  const response = await runDigest(new NextRequest('https://example.test/api/cron/morning-brief'), 'morning');
  expect(await response.json()).toEqual({ ok: true, skipped: 'private-notifications-paused' });
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.queue).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FINNHUB_API_KEY', 'test-not-a-key');
  vi.stubEnv('NEXT_PUBLIC_FINNHUB_API_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test');
  mocks.queue.mockResolvedValue(true);
  mocks.process.mockResolvedValue({ sent: 0, retryable: 0, failed: 0, cancelled: 0, reportedFailures: 0 });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('USDKRW')
    ? { c: 1300, t: Date.now() / 1000 }
    : { c: 100, d: 5, dp: 5.26, t: Date.now() / 1000 })));
});

it.each([
  { server: '', legacy: 'legacy-test-key', expected: 'legacy-test-key' },
  { server: 'server-test-key', legacy: 'legacy-test-key', expected: 'server-test-key' },
])('resolves production quote configuration with server key "$server"', async ({ server, legacy, expected }) => {
  vi.stubEnv('FINNHUB_API_KEY', server);
  vi.stubEnv('NEXT_PUBLIC_FINNHUB_API_KEY', legacy);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
  const user_id = 'healthy-user';
  const portfolio = { user_id, stocks: { investing: [
    { symbol: 'MSFT', shares: 1, avgCost: 90, targetReturn: 10 },
    { symbol: '005930.KS', shares: 1, avgCost: 90, targetReturn: 10 },
  ], watching: [], sold: [] }, daily_snapshots: [] };
  mocks.db = {
    from: (table: string) => ({ select: () => table === 'push_subscriptions'
      ? Promise.resolve({ data: [], error: null })
      : table === 'email_subscriptions'
        ? { eq: async () => ({ data: [{ user_id }], error: null }) }
        : { in: async () => ({ data: [portfolio], error: null }) } }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'healthy@example.test' } }, error: null }) } },
  };
  const response = await runDigest(new NextRequest('https://joobi.kr/api/cron/morning-brief'), 'morning');
  expect(response.status).toBe(200);
  const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(urls).toContain(`https://finnhub.io/api/v1/quote?symbol=MSFT&token=${expected}`);
  expect(urls).toContain('https://joobi.kr/api/kr-quote?symbol=005930.KS');
  expect(urls).toContain('https://joobi.kr/api/kr-quote?symbol=USDKRW=X');
  const payload = mocks.queue.mock.calls[0][1].payload.email;
  expect(payload.text).toContain('현재 평가액: 13만원');
  expect(payload.text).toContain('자세히 보기: https://joobi.kr');
  expect(payload.text).not.toContain('미확인');
  expect(JSON.stringify(await response.json())).not.toContain(expected);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('queues later subscribers after one recipient lookup fails and reports the producer gap', async () => {
  const users = ['failed-user', 'healthy-user'];
  const portfolios = users.map(user_id => ({ user_id, stocks: {
    investing: [{ symbol: 'MSFT', shares: 1, avgCost: 90, targetReturn: 10 }], watching: [], sold: [],
  }, daily_snapshots: [] }));
  mocks.db = {
    from: (table: string) => ({ select: () => table === 'push_subscriptions'
      ? Promise.resolve({ data: [], error: null })
      : table === 'email_subscriptions'
        ? { eq: async () => ({ data: users.map(user_id => ({ user_id })), error: null }) }
        : { in: async () => ({ data: portfolios, error: null }) } }),
    auth: { admin: { getUserById: async (id: string) => id === users[0]
      ? { data: { user: null }, error: { message: 'private upstream detail' } }
      : { data: { user: { email: 'healthy@example.test' } }, error: null } } },
  };
  const response = await runDigest(new NextRequest('https://example.test/api/cron/morning-brief'), 'morning');
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ ok: false, queued: 1, errors: ['digest_user_failed'] });
  expect(mocks.queue).toHaveBeenCalledWith(mocks.db, expect.objectContaining({ userId: 'healthy-user', channel: 'email' }));
  expect(mocks.process).toHaveBeenCalledTimes(1);
  expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ stage: 'enqueue', context: expect.objectContaining({ failedUsers: 1 }) }));
  expect(JSON.stringify(mocks.alert.mock.calls)).not.toMatch(/healthy@example|private upstream|failed-user/);
});
