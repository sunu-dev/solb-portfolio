import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendCronAlert } from '@/lib/cronAlert';

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
})();

const BUG_WEBHOOK = process.env.SLACK_WEBHOOK_BUG || process.env.SLACK_WEBHOOK_URL || '';

interface ReportBody {
  category?: 'bug' | 'feedback' | 'praise' | 'payment';
  message: string;
  page?: string;
  email?: string;     // 비로그인 사용자가 응답 받을 곳
  viewport?: string;
  appVersion?: string;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'config missing' }, { status: 503 });
  }

  let body: ReportBody;
  try {
    body = await req.json() as ReportBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const message = (body.message || '').trim();
  if (!message || message.length < 5) {
    return NextResponse.json({ ok: false, error: '내용을 5자 이상 입력해주세요.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ ok: false, error: '2000자 이내로 입력해주세요.' }, { status: 400 });
  }

  // 인증된 사용자면 user_id 추출 (선택)
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id ?? null;
    } catch { /* anonymous */ }
  }

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null;
  const category = body.category || 'bug';

  try {
    const { error } = await supabaseAdmin.from('bug_reports').insert({
      user_id: userId,
      user_email: body.email?.trim() || null,
      category,
      page: body.page?.slice(0, 200) || null,
      message,
      user_agent: userAgent,
      viewport: body.viewport?.slice(0, 50) || null,
      app_version: body.appVersion?.slice(0, 50) || null,
    });
    if (error) {
      console.error('[feedback/report] DB insert failed:', error);
      return NextResponse.json({ ok: false, error: '저장 실패. 잠시 후 다시 시도해주세요.' }, { status: 500 });
    }
  } catch (e) {
    console.error('[feedback/report] DB error:', e);
    return NextResponse.json({ ok: false, error: '저장 실패' }, { status: 500 });
  }

  // Slack #beta-bug 알림 (미설정 시 silent)
  if (BUG_WEBHOOK) {
    try {
      const emoji = category === 'bug' ? '🐛' : category === 'feedback' ? '💬' : category === 'payment' ? '💳' : '✨';
      const lines = [
        `*${emoji} 신규 ${category}*${body.page ? ` · ${body.page}` : ''}`,
        '```' + message.slice(0, 1500) + '```',
        userId ? `user_id: ${userId.slice(0, 8)}...` : `anon · ${body.email || 'no email'}`,
        userAgent ? `UA: ${userAgent.slice(0, 100)}` : '',
      ].filter(Boolean);
      await fetch(BUG_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lines.join('\n') }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) {
      // 신고 자체는 저장됐으니 webhook 실패는 silent + Sentry 캡쳐
      console.error('[feedback/report] slack webhook failed:', e);
      // sendCronAlert 활용 — runtime 실패 추적
      await sendCronAlert({
        jobName: 'feedback-report',
        stage: 'slack-webhook',
        error: e,
        level: 'warn',
      });
    }
  }

  return NextResponse.json({ ok: true });
}
