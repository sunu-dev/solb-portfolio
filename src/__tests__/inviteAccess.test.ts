import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentInviteAccess, resolveInviteAccess } from '@/lib/inviteAccess';

function setup() {
  const read = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle: read }));
  const session = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'a' }, access_token: 'test' } }, error: null });
  const client = { auth: { getSession: session }, from: vi.fn(() => ({ select: () => ({ eq }) })) } as unknown as SupabaseClient;
  const request = vi.fn(async (url: string) => Response.json(url === '/api/config'
    ? { config: { service_mode: 'beta', invite_required: 'true' } } : { isAdmin: false }));
  return { client, request, read, eq, session };
}

describe('초대 확인 전 화면 진입 차단', () => {
  it('최초 조회와 계정 변경에는 기존 허용 결과를 사용하지 않는다', () => {
    expect(currentInviteAccess('a', null)).toBe('checking');
    expect(currentInviteAccess('b', { userId: 'a', status: 'allowed' })).toBe('checking');
    expect(currentInviteAccess('a', { userId: 'a', status: 'required' })).toBe('required');
  });
  it('초대 조회가 늦어도 중간에 allowed를 반환하지 않는다', async () => {
    const s = setup();
    let finish!: (v: { data: null; error: null }) => void;
    s.read.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const completed = vi.fn();
    const result = resolveInviteAccess(s.client, 'a', s.request as typeof fetch).then(completed);
    await vi.waitFor(() => expect(s.read).toHaveBeenCalled());
    expect(completed).not.toHaveBeenCalled();
    finish({ data: null, error: null });
    await result;
    expect(completed).toHaveBeenCalledWith('required');
  });
  it('초대 이력이 있는 본인만 허용한다', async () => {
    const s = setup();
    s.read.mockResolvedValue({ data: { invited_by_code: 'test' }, error: null });
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('allowed');
    expect(s.eq).toHaveBeenCalledWith('user_id', 'a');
  });
  it('조회 실패를 미가입 또는 허용으로 오인하지 않는다', async () => {
    const s = setup();
    s.read.mockResolvedValue({ data: null, error: { message: 'offline' } });
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('error');
  });
  it('설정 API 실패는 기본 open으로 처리하지 않는다', async () => {
    const s = setup();
    s.request.mockResolvedValue(new Response('', { status: 500 }));
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('error');
    expect(s.read).not.toHaveBeenCalled();
  });
  it('조회 시점의 계정이 다르면 이전 계정으로 판정하지 않는다', async () => {
    const s = setup();
    expect(await resolveInviteAccess(s.client, 'b', s.request as typeof fetch)).toBe('error');
    expect(s.request).not.toHaveBeenCalled();
  });
  it('서버에서 확인한 관리자만 초대 면제한다', async () => {
    const s = setup();
    s.request.mockImplementation(async url => Response.json(url === '/api/config'
      ? { config: { service_mode: 'beta', invite_required: 'true' } } : { isAdmin: true }));
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('allowed');
    expect(s.read).not.toHaveBeenCalled();
  });
});
