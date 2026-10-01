import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';

// 유효성 조회만으로 입장시키지 않는다. 인증 신원 + DB 원자 적용 결과가 모두 필요하다.
export const POST = defineRoute({
  name: '/api/codes/validate',
  auth: 'user',
  handler: async ({ req, userId }) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ valid: false, error: '올바른 요청이 아니에요.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ valid: false, error: '코드를 입력해주세요.' }, { status: 400 });
    }
    const { code, context = 'signup' } = body as Record<string, unknown>;
    if (typeof code !== 'string' || !/^[A-Z0-9-]{4,32}$/i.test(code.trim()) || context !== 'signup') {
      return NextResponse.json({ valid: false, error: '가입용 코드를 확인해주세요.' }, { status: 400 });
    }
    const { data, error } = await requireServiceClient().rpc('apply_signup_code', {
      p_code: code.trim().toUpperCase(),
      p_user_id: userId,
    });
    if (error) {
      // 사용자 식별자, 코드, DB 상세 오류를 로그나 응답에 노출하지 않는다.
      console.error('[codes/validate] atomic apply failed', { code: error.code });
      return NextResponse.json({
        valid: false, applied: false, error: '코드를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
      }, { status: 503 });
    }
    if (data?.valid !== true || data?.applied !== true) {
      return NextResponse.json({
        valid: false, applied: false,
        error: typeof data?.error === 'string' ? data.error : '코드 적용 결과를 확인하지 못했어요.',
      }, { status: 409 });
    }
    return NextResponse.json({
      valid: true, applied: true, type: data.type,
      personal_code: typeof data.personal_code === 'string' ? data.personal_code : undefined,
      message: '초대 코드가 등록됐어요. 주비에 오신 걸 환영해요!',
    });
  },
});
