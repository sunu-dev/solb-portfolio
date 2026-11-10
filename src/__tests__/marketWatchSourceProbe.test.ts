import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { probe, refresh } = vi.hoisted(() => ({
  probe: vi.fn(async () => [{ source: 'krx', ok: false, reason: 'Exchange source returned 403' }]),
  refresh: vi.fn(async () => ({ skipped: false, count: 1 })),
}));
vi.mock('@/lib/marketWatchCollector', () => ({ probeWatchSources: probe }));
vi.mock('@/lib/marketWatchStore', () => ({ refreshMarketWatch: refresh }));
vi.mock('@/lib/rateLimiter', () => ({ POLICIES: { general: {} }, getClientIp: () => 'test',
  recordApiCall: vi.fn(), checkRateLimit: vi.fn(), rateLimitResponse: vi.fn() }));
vi.mock('@/lib/adminAuth', () => ({ isAdminIdentity: vi.fn(), resolveUserOutcome: vi.fn() }));
import { GET } from '@/app/api/cron/market-watch/route';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const request = (diagnose: boolean, secret?: string) => new NextRequest(`https://joobi.kr/api/cron/market-watch${diagnose ? '?diagnose=1' : ''}`,
  { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });

describe('source diagnostics preserve the production cron boundary', () => {
  it('rejects unauthenticated diagnostics before any source lookup or publishing', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    expect((await GET(request(true))).status).toBe(401);
    expect(probe).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  it('rejects Bearer undefined when the scheduler secret is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(request(true, 'undefined'))).status).toBe(401);
    expect(probe).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  it('runs the authenticated diagnostic without publishing a collection', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    const response = await GET(request(true, 'test-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ probes: [{ source: 'krx', ok: false, reason: 'Exchange source returned 403' }] });
    expect(probe).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled();
  });
  it('keeps the regular authenticated collection path', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    expect((await GET(request(false, 'test-secret'))).status).toBe(200);
    expect(refresh).toHaveBeenCalledWith('market'); expect(probe).not.toHaveBeenCalled();
  });
});
