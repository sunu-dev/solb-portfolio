import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const m = vi.hoisted(() => ({ after: vi.fn(), record: vi.fn(), limit: vi.fn() }));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: m.after }));
vi.mock('@/lib/rateLimiter', () => ({ POLICIES: { general: {} }, getClientIp: () => 'fixture', checkRateLimit: m.limit,
  recordApiCall: m.record, rateLimitResponse: () => NextResponse.json({ code: 'rate_limit' }, { status: 429 }) }));
vi.mock('@/lib/adminAuth', () => ({ resolveUserOutcome: vi.fn(async () => ({ status: 'unavailable' })), isAdminIdentity: () => false }));
import { defineRoute } from '@/lib/apiRoute';
beforeEach(() => { vi.clearAllMocks(); m.limit.mockResolvedValue({ allowed: true }); m.record.mockImplementation(() => new Promise(() => {})); });
it('returns public data before a stuck log write and exposes admission/handler timings', async () => {
  const handler = defineRoute({ name: 'fixture', auth: 'public', deferLog: true, handler: () => NextResponse.json({ ok: true }) });
  const response = await handler(new NextRequest('http://localhost/fixture'));
  expect(response.status).toBe(200); expect(m.record).not.toHaveBeenCalled(); expect(m.after).toHaveBeenCalledOnce();
  expect(response.headers.get('Server-Timing')).toMatch(/admission;dur=\d+, handler;dur=\d+/);
});
it('does not defer the rate limit decision or bypass authentication', async () => {
  const work = vi.fn(); m.limit.mockResolvedValue({ allowed: false });
  expect((await defineRoute({ name: 'fixture', auth: 'public', deferLog: true, handler: work })(new NextRequest('http://localhost'))).status).toBe(429);
  expect((await defineRoute({ name: 'fixture', auth: 'user', deferLog: true, handler: work })(new NextRequest('http://localhost'))).status).toBe(503);
  expect(work).not.toHaveBeenCalled();
});
