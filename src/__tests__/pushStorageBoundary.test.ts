import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), upsert: vi.fn(), eq: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({
  requireAuthClient: () => ({ auth: { getUser: mocks.auth } }),
  getServiceClient: mocks.service,
}));
import { POST, DELETE } from '@/app/api/push/subscribe/route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: 'verified-user' } } });
  mocks.upsert.mockResolvedValue({ error: null }); mocks.eq.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: () => ({ eq: mocks.eq }) });
  mocks.service.mockReturnValue({ from: mocks.from });
});
const post = (body: unknown) => new NextRequest('https://example.com/api/push/subscribe', { method: 'POST', body: JSON.stringify(body) });
describe('푸시 저장 권한 경계', () => {
  it('검증된 사용자 ID로만 서비스 저장한다', async () => {
    expect((await POST(post({ token: 'test-token', user_id: 'other-user', subscription: { endpoint: 'https://example.com/push' } }))).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'verified-user' }), { onConflict: 'user_id' });
  });
  it('무효 토큰은 저장 전에 차단한다', async () => {
    mocks.auth.mockResolvedValue({ data: { user: null } });
    expect((await POST(post({ token: 'bad', subscription: { endpoint: 'https://example.com/push' } }))).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it('서비스 설정 누락을 503으로 반환한다', async () => {
    mocks.service.mockReturnValue(null);
    expect((await POST(post({ token: 'test', subscription: { endpoint: 'https://example.com/push' } }))).status).toBe(503);
  });
  it('잘못된 JSON을 400으로 반환한다', async () => {
    expect((await POST(new NextRequest('https://example.com/api/push/subscribe', { method: 'POST', body: '{' }))).status).toBe(400);
  });
  it('삭제 실패를 성공으로 표시하지 않는다', async () => {
    mocks.eq.mockResolvedValue({ error: { code: 'failure' } });
    expect((await DELETE(new NextRequest('https://example.com/api/push/subscribe', { method: 'DELETE', headers: { Authorization: 'Bearer test' } }))).status).toBe(500);
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'verified-user');
  });
});
