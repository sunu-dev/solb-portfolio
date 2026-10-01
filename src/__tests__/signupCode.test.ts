import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), handler: null as unknown }));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: () => ({ rpc: mock.rpc }) }));
vi.mock('@/lib/apiRoute', () => ({ defineRoute: (config: unknown) => { mock.handler = config; return config; } }));
import '@/app/api/codes/validate/route';

const config = () => mock.handler as {
  auth: string;
  handler: (ctx: { req: NextRequest; userId: string }) => Promise<Response>;
};
const request = (body: unknown) => config().handler({
  req: new NextRequest('https://example.test/api/codes/validate', {
    method: 'POST', body: JSON.stringify(body),
  }), userId: 'verified-user',
});

describe('가입 코드 원자 적용', () => {
  beforeEach(() => mock.rpc.mockReset());
  it('공통 인증과 레이트리밋 래퍼를 사용한다', () => {
    expect(config().auth).toBe('user');
  });
  it('body userId를 무시하고 검증된 신원으로 RPC를 한 번 호출한다', async () => {
    mock.rpc.mockResolvedValue({ data: { valid: true, applied: true, type: 'invite' }, error: null });
    const response = await request({ code: ' solb-test ', userId: 'forged-user' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ valid: true, applied: true });
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('apply_signup_code', {
      p_code: 'SOLB-TEST', p_user_id: 'verified-user',
    });
  });
  it.each([{}, null, { code: 123 }, { code: ' ' }, { code: 'SOLB-TEST', context: 'preview' }])(
    '잘못된 요청은 DB 호출 전에 거절한다: %j', async (body) => {
      expect((await request(body)).status).toBe(400);
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it('RPC 실패는 성공으로 처리하지 않는다', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'private db details' } });
    const response = await request({ code: 'SOLB-TEST' });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ valid: false, applied: false });
    expect(JSON.stringify(body)).not.toContain('private db details');
  });
  it.each([null, { valid: true }, { valid: false, error: '이미 모두 사용된 코드예요.' }])(
    '적용 성공이 명확하지 않으면 게이트를 열지 않는다: %j', async (data) => {
      mock.rpc.mockResolvedValue({ data, error: null });
      const response = await request({ code: 'SOLB-TEST' });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ valid: false, applied: false });
    },
  );
  // DB migration 검사는 로컬/저장소 CI에서 실행. Vercel 앱 배포에는 SQL 원본을 싣지 않는다.
  it.skipIf(process.env.VERCEL === '1')('마이그레이션은 코드 행 잠금과 서버 전용 실행 권한을 선언한다', () => {
    const sql = readFileSync('supabase/migrations/20260908000200_atomic_signup_code.sql', 'utf8');
    expect(sql).toContain('for update');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('exception when');
    expect(sql).toContain('do update set invited_by_code = excluded.invited_by_code');
  });
  it.skipIf(process.env.VERCEL === '1')('기존 테이블에도 누락 컬럼을 추가하며 보유 데이터는 변경하지 않는다', () => {
    const sql = readFileSync('supabase/migrations/20260908000100_restore_daily_snapshots.sql', 'utf8');
    expect(sql).toContain("add column if not exists daily_snapshots jsonb not null default '[]'::jsonb");
    expect(sql).not.toMatch(/\b(delete|truncate|drop)\b/i);
  });
  it.skipIf(process.env.VERCEL === '1')('가입 성공과 개인 초대코드 발급 및 베타 정원 확인을 한 트랜잭션으로 묶는다', () => {
    const sql = readFileSync('supabase/migrations/20260918000100_personal_invite_chain.sql', 'utf8');
    expect(sql).toContain('ensure_personal_invite_code');
    expect(sql).toContain("'JOOBI-'");
    expect(sql).toContain("'invite',\n        p_user_id,\n        1,");
    expect(sql).toContain("hashtextextended('beta_signup_capacity', 0)");
    expect(sql).toContain("where key = 'beta_max_users'");
    expect(sql).toContain("count(distinct used_by)");
    expect(sql).toContain("'personal_code', v_personal_code");
    expect(sql).toContain('grant execute on function public.ensure_personal_invite_code(uuid) to service_role');
    expect(sql).toContain('grant execute on function public.apply_signup_code(text, uuid) to service_role');
  });
});
