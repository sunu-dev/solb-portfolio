import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // 서버 설정 상태와 무관하게 인증 없는 요청은 먼저 401로 닫는다.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요해요.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
  }

  const token = authHeader.replace('Bearer ', '');

  // anon key로 토큰 검증
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
    // 명시 삭제가 필요한 사용자 데이터. FK cascade가 있는 테이블도 먼저 지워
    // Auth 삭제 전 오류를 관측하고 개인정보가 남는 부분 성공을 피한다.
    const cleanupResults = await Promise.all([
      adminClient.from('user_portfolios').delete().eq('user_id', userId),
      adminClient.from('ai_usage').delete().eq('user_id', userId),
      adminClient.from('ai_chok_cache').delete().eq('user_key', userId),
      adminClient.from('email_subscriptions').delete().eq('user_id', userId),
      adminClient.from('push_subscriptions').delete().eq('user_id', userId),
      adminClient.from('user_consents').delete().eq('user_id', userId),
      adminClient.from('ai_chok_recommendations').delete().eq('user_id', userId),
      adminClient.from('alert_log').delete().eq('user_id', userId),
      adminClient.from('notification_log').delete().eq('user_id', userId),
      adminClient.from('sent_alerts').delete().eq('user_id', userId),
      adminClient.from('ai_feedback').delete().eq('user_id', userId),
      adminClient.from('bug_reports').delete().eq('user_id', userId),
      adminClient.from('api_calls').delete().eq('user_id', userId),
      adminClient.from('api_logs').delete().eq('user_id', userId),
      adminClient.from('tour_events').delete().eq('user_id', userId),
      adminClient.from('ai_cost_ledger').delete().eq('user_id', userId),
      adminClient.from('pro_demand_events').delete().eq('user_id', userId),
      adminClient.from('user_credits').delete().eq('user_id', userId),
      adminClient.from('code_uses').delete().eq('used_by', userId),
      // 발급 코드는 다른 사용자의 크레딧 이력에서 참조할 수 있으므로 보존하고
      // 탈퇴한 생성자 연결만 제거한다.
      adminClient.from('codes').update({ created_by: null }).eq('created_by', userId),
      adminClient.from('profiles').delete().eq('id', userId),
    ]);

    // 선택 기능의 테이블이 아직 생성되지 않은 환경(PGRST205/42P01)은 건너뛰되,
    // 실제 삭제 실패는 Auth 계정을 지우기 전에 중단한다.
    const cleanupErrors = cleanupResults
      .map(result => result.error)
      .filter((error): error is NonNullable<typeof error> => (
        !!error && error.code !== 'PGRST205' && error.code !== '42P01'
      ));
    if (cleanupErrors.length > 0) {
      throw new Error(`user data cleanup failed: ${cleanupErrors.map(error => `${error.code}:${error.message}`).join(' | ')}`);
    }

    // Auth 계정 실제 삭제
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[account/delete]', e);
    return NextResponse.json({ error: '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
