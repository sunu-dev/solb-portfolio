import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ db: vi.fn(() => { throw new Error('database must not be accessed'); }), send: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getServiceClient: mocks.db, requireServiceClient: mocks.db }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: mocks.send } }));
vi.mock('@/utils/email', () => ({ sendEmail: mocks.send }));
vi.mock('@/lib/cronAlert', () => ({ sendCronAlert: vi.fn() }));
// The existing shared cron authentication wrapper is unchanged. Exercise the
// monthly handler's pause before any date/subscription/portfolio processing.
vi.mock('@/lib/apiRoute', () => ({ defineRoute: ({ handler }: { handler: () => Promise<Response> }) => handler }));
import { GET as alerts } from '@/app/api/cron/check-alerts/route';
import { GET as monthly } from '@/app/api/cron/monthly-d3-reminder/route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', 'on');
  vi.stubEnv('CRON_SECRET', 'synthetic-test-secret');
});
afterEach(() => vi.unstubAllEnvs());
it('pauses authenticated alerts before service credentials, subscriptions or portfolio reads', async () => {
  const result = await alerts(new NextRequest('https://example.test/api/cron/check-alerts', { headers: { authorization: 'Bearer synthetic-test-secret' } }));
  expect(await result.json()).toEqual({ ok: true, skipped: 'private-notifications-paused' });
  expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it('does not bypass alerts authentication when paused', async () => {
  expect((await alerts(new NextRequest('https://example.test/api/cron/check-alerts'))).status).toBe(401);
  expect(mocks.db).not.toHaveBeenCalled();
});
it('pauses monthly processing before service access on any date', async () => {
  const result = await monthly(new NextRequest('https://example.test/api/cron/monthly-d3-reminder'));
  expect(await result.json()).toEqual({ ok: true, skipped: 'private-notifications-paused' });
  expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
