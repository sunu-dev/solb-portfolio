/**
 * 이메일 unsubscribe — RFC 8058 1-click compliant
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * 흐름:
 *   GET  /api/email/unsubscribe?token=...  — 사용자 클릭 (브라우저, HTML 응답)
 *   POST /api/email/unsubscribe?token=...  — 메일 클라이언트 자동 호출 (RFC 8058)
 *
 * 토큰: utils/unsubscribeToken — HMAC-SHA256, stateless. DB 조회 없이 검증.
 * 작업: email_subscriptions 행 update (해당 kind을 false로). all이면 모두 false.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubToken } from '@/utils/unsubscribeToken';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function applyUnsub(userId: string, kind: 'morning_brief' | 'monthly_d3' | 'all') {
  const supabase = getAdmin();
  const update: Record<string, boolean | string> = {
    updated_at: new Date().toISOString(),
  };
  if (kind === 'morning_brief' || kind === 'all') update.morning_brief_enabled = false;
  if (kind === 'monthly_d3'   || kind === 'all') update.monthly_d3_enabled   = false;

  await supabase
    .from('email_subscriptions')
    .upsert({ user_id: userId, ...update }, { onConflict: 'user_id' });
}

function htmlResponse(message: string, success = true): Response {
  const color = success ? '#3182F6' : '#EF4452';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>이메일 구독 해제</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; padding: 40px 20px; max-width: 480px; margin: 0 auto; color: #191F28; line-height: 1.6; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .msg { font-size: 18px; font-weight: 700; color: ${color}; margin-bottom: 12px; }
    .sub { font-size: 14px; color: #8B95A1; }
    .back { display: inline-block; margin-top: 24px; padding: 10px 20px; background: #3182F6; color: white; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="icon">${success ? '✅' : '⚠️'}</div>
  <div class="msg">${message}</div>
  <div class="sub">언제든 앱 설정에서 다시 구독할 수 있어요.</div>
  <a href="${process.env.NEXT_PUBLIC_APP_URL || '/'}" class="back">앱으로 돌아가기</a>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const verified = verifyUnsubToken(token);
  if (!verified) return htmlResponse('잘못된 링크예요. 만료되었거나 변조됐을 수 있어요.', false);

  try {
    await applyUnsub(verified.userId, verified.kind);
    const kindLabel = verified.kind === 'morning_brief' ? '모닝 브리핑'
      : verified.kind === 'monthly_d3' ? '월말 D-3 리마인더'
      : '모든 이메일 알림';
    return htmlResponse(`${kindLabel} 이메일 구독이 해제됐어요.`);
  } catch (e) {
    console.error('[email/unsubscribe] error', e);
    return htmlResponse('구독 해제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.', false);
  }
}

/**
 * RFC 8058 1-click — 메일 클라이언트가 자동으로 POST 호출.
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click` 헤더와 짝.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const verified = verifyUnsubToken(token);
  if (!verified) return NextResponse.json({ error: 'invalid_token' }, { status: 400 });

  try {
    await applyUnsub(verified.userId, verified.kind);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
