import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  result: {} as { data: { key: string; value: string }[] | null; error: { code: string; message: string } | null; status: number },
  abortSignal: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  requireServiceClient: () => ({ from: () => ({ select: () => ({ abortSignal: state.abortSignal }) }) }),
}));
vi.mock('@/lib/adminAuth', () => ({
  resolveUser: async () => null,
  isAdminIdentity: () => false,
  requireAdmin: vi.fn(),
}));

import { GET } from '@/app/api/config/route';

const request = () => new NextRequest('https://joobi.test/api/config');

beforeEach(() => {
  vi.clearAllMocks();
  state.abortSignal.mockImplementation(async (signal: AbortSignal) => {
    expect(signal).toBeInstanceOf(AbortSignal);
    return state.result;
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('공개 설정 API', () => {
  it('service-role로 읽어도 공개 허용 키만 내보낸다', async () => {
    state.result = { status: 200, error: null, data: [
      { key: 'service_mode', value: 'beta' },
      { key: 'invite_required', value: 'true' },
      { key: 'internal_secret', value: 'hidden' },
    ] };
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ config: { service_mode: 'beta', invite_required: 'true' } });
  });

  it('상위 공급자 오류가 나면 설정을 추측하지 않고 캐시하지 않는다', async () => {
    state.result = { status: 504, data: null, error: { code: '', message: '<!DOCTYPE html> upstream failure' } };
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'config unavailable' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('<!DOCTYPE html>');
  });
});
