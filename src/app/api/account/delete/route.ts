import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
  }

  // 요청자 인증 확인
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  // anon key로 토큰 검증
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: '유효하지 않은 인증 정보입니다.' }, { status: 401 });
  }

  const userId = user.id;

  // service role key로 Admin 클라이언트 생성
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // DB 데이터 삭제
    await Promise.all([
      adminClient.from('user_portfolios').delete().eq('user_id', userId),
      adminClient.from('ai_usage').delete().eq('user_id', userId),
      adminClient.from('ai_chok_cache').delete().eq('user_key', userId),
    ]);

    // Auth 계정 실제 삭제
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[account/delete]', e);
    return NextResponse.json({ error: '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
