import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentInviteAccess, resolveInviteAccess } from '@/lib/inviteAccess';

function setup() {
  const read = vi.fn().mockResolvedValue({ data: null, error: null });
  const abort = vi.fn((_signal: AbortSignal) => ({ maybeSingle: read }));
  const eq = vi.fn(() => ({ abortSignal: abort }));
  const session = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'a' }, access_token: 'test' } }, error: null });
  const client = { auth: { getSession: session }, from: vi.fn(() => ({ select: () => ({ eq }) })) } as unknown as SupabaseClient;
  const request = vi.fn(async (url: string) => Response.json(url === '/api/config'
    ? { config: { service_mode: 'beta', invite_required: 'true' } } : { isAdmin: false }));
  return { client, request, read, eq, session, abort };
}
afterEach(() => vi.useRealTimers());

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
    expect(s.request).not.toHaveBeenCalled();
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
    expect(s.read).toHaveBeenCalledTimes(1);
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
    expect(s.read).toHaveBeenCalledTimes(1);
  });
  it('로컬 기록이 아닌 서버 조회 성공과 초대 기록이 모두 있어야 빠르게 허용한다', async () => {
    const s = setup();
    s.read.mockResolvedValue({ data: { invited_by_code: 'stale' }, error: { message: 'offline' } });
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('error');
    expect(s.request).toHaveBeenCalledTimes(2);
  });
  it('초대가 없어도 공개 모드와 서버 관리자 확인은 기존대로 적용한다', async () => {
    const s = setup();
    s.request.mockImplementation(async url => Response.json(url === '/api/config'
      ? { config: { service_mode: 'open', invite_required: 'false' } } : { isAdmin: false }));
    expect(await resolveInviteAccess(s.client, 'a', s.request as typeof fetch)).toBe('allowed');
  });
  it('초대 DB와 설정이 멈춰도 서버에서 확인한 관리자 결과로 진행한다', async () => {
    vi.useFakeTimers();
    const s = setup();
    s.read.mockReturnValue(new Promise(() => {}));
    s.request.mockImplementation(url => url === '/api/config' ? new Promise(() => {}) : Promise.resolve(Response.json({ isAdmin: true })));
    const result = resolveInviteAccess(s.client, 'a', s.request as typeof fetch);
    await vi.advanceTimersByTimeAsync(150);
    expect(await result).toBe('allowed');
    expect(s.abort.mock.calls[0][0].aborted).toBe(true);
  });
  it('모든 조회가 멈추면 6초에 오류를 알리고 진행 요청을 취소한다', async () => {
    vi.useFakeTimers();
    const s = setup();
    s.read.mockReturnValue(new Promise(() => {}));
    s.request.mockImplementation(() => new Promise(() => {}));
    const result = resolveInviteAccess(s.client, 'a', s.request as typeof fetch);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toBe('error');
    expect(s.abort.mock.calls[0][0].aborted).toBe(true);
    expect(s.request).toHaveBeenCalledTimes(2);
  });
  it('관리자가 아니고 설정이 실패해도 늦게 도착한 본인 초대는 인정한다', async () => {
    vi.useFakeTimers();
    const s = setup();
    let finish!: (value: { data: { invited_by_code: string }; error: null }) => void;
    s.read.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    s.request.mockResolvedValue(new Response('', { status: 503 }));
    const result = resolveInviteAccess(s.client, 'a', s.request as typeof fetch);
    await vi.advanceTimersByTimeAsync(200);
    finish({ data: { invited_by_code: 'confirmed' }, error: null });
    expect(await result).toBe('allowed');
  });
});
