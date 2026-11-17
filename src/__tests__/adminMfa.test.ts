import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), after: () => {} }));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), db: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({
  getServiceClient: () => ({ auth: { getUser: mocks.getUser } }),
  requireServiceClient: () => ({ from: mocks.db }),
}));
vi.mock('@/lib/rateLimiter', () => ({
  POLICIES: { general: {} }, getClientIp: () => '127.0.0.1',
  checkRateLimit: async () => ({ allowed: true }), recordApiCall: async () => {}, rateLimitResponse: () => NextResponse.json({}, { status: 429 }),
}));
import { requireAdmin } from '@/lib/adminAuth';
import { defineRoute } from '@/lib/apiRoute';
import { GET as overview } from '@/app/api/admin/overview/route';
import { GET as adminStatus } from '@/app/api/me/admin/route';
import { GET as codes, POST as createCodes, PATCH as patchCodes } from '@/app/api/codes/generate/route';

const request = (claims: Record<string, unknown> = {}, method = 'GET') => new NextRequest('https://example.test/api/admin/test', {
  method, headers: { authorization: `Bearer e30.${Buffer.from(JSON.stringify({ sub: 'mfa-admin', ...claims })).toString('base64url')}.test-signature` },
});
beforeEach(() => {
  vi.stubEnv('ADMIN_IDS', 'mfa-admin'); vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'mfa-admin', email: 'admin@example.test' } }, error: null });
  mocks.db.mockReset();
});

describe('administrator MFA server boundary', () => {
  it.each([{}, { aal: 'aal1' }, { aal: 'aal3' }, { aal: 'aal2', sub: 'someone-else' }])('denies unverified assurance %j in both guards', async claims => {
    const result = await requireAdmin(request(claims));
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.res.status).toBe(403); expect((await result.res.json()).code).toBe('mfa_required'); }
    const handler = vi.fn(async () => NextResponse.json({ secret: true }));
    const response = await defineRoute({ name: '/test', auth: 'admin', handler })(request(claims));
    expect(response.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it('allows authenticated administrator AAL2 in both guards', async () => {
    expect((await requireAdmin(request({ aal: 'aal2' }))).ok).toBe(true);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    expect((await defineRoute({ name: '/test', auth: 'admin', handler })(request({ aal: 'aal2' }))).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
  it('rejects forged AAL2 when Auth rejects the exact token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    const result = await requireAdmin(request({ aal: 'aal2' }));
    expect(result.ok).toBe(false); if (!result.ok) expect(result.res.status).toBe(401);
  });
  it('does not grant admin to an AAL2 regular user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'regular', email: 'regular@example.test' } }, error: null });
    const result = await requireAdmin(request({ aal: 'aal2', sub: 'regular' }));
    expect(result.ok).toBe(false); if (!result.ok) expect((await result.res.json()).code).toBe('forbidden');
  });
  it('keeps Auth outages distinct from MFA requirements', async () => {
    mocks.getUser.mockRejectedValue(new Error('unavailable'));
    const result = await requireAdmin(request({ aal: 'aal2' }));
    expect(result.ok).toBe(false); if (!result.ok) expect(result.res.status).toBe(503);
  });
  it('allows enrollment discovery but reveals no privileged data at AAL1', async () => {
    const response = await adminStatus(request({ aal: 'aal1' }));
    expect(await response.json()).toEqual({ isAdmin: true, mfaRequired: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([[overview, 'GET'], [codes, 'GET'], [createCodes, 'POST'], [patchCodes, 'PATCH']] as const)('closes legacy code endpoint before database work', async (route, method) => {
    expect((await route(request({ aal: 'aal1' }, method))).status).toBe(403);
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
