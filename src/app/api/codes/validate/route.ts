import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { code, userId, context = 'signup' } = await req.json() as {
      code: string;
      userId?: string;
      context?: string;
    };

    if (!code?.trim()) {
      return NextResponse.json({ valid: false, error: '코드를 입력해주세요.' }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();

    // 코드 조회
    const { data: codeRow, error } = await supabaseAdmin
      .from('codes')
      .select('*')
      .eq('code', normalized)
      .eq('is_active', true)
      .single();

    if (error || !codeRow) {
      return NextResponse.json({ valid: false, error: '유효하지 않은 코드예요.' });
    }

    // 만료 확인
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: '만료된 코드예요.' });
    }

    // 사용 횟수 확인
    if (codeRow.max_uses !== null && codeRow.use_count >= codeRow.max_uses) {
      return NextResponse.json({ valid: false, error: '이미 모두 사용된 코드예요.' });
    }

    // 중복 사용 확인 (같은 유저가 같은 코드 재사용 방지)
    if (userId) {
      const { data: existing } = await supabaseAdmin
        .from('code_uses')
        .select('id')
        .eq('code', normalized)
        .eq('used_by', userId)
        .single();

      if (existing) {
        return NextResponse.json({ valid: false, error: '이미 사용한 코드예요.' });
      }
    }

    // context가 signup이고 userId가 있으면 즉시 적용
    if (context === 'signup' && userId) {
      await applyCode(codeRow, userId, context);
    }

    return NextResponse.json({
      valid: true,
      type: codeRow.type,
      rewards: codeRow.rewards,
      message: getSuccessMessage(codeRow.type, codeRow.rewards),
    });
  } catch (e) {
    console.error('Code validate error:', e);
    return NextResponse.json({ valid: false, error: '오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 });
  }
}

async function applyCode(codeRow: Record<string, unknown>, userId: string, context: string) {
  // 트랜잭션처럼 처리 (Supabase는 RPC로 트랜잭션 가능하나 여기선 순차 처리)
  const rewards = (codeRow.rewards as Record<string, unknown>) || {};

  // 1. 사용 기록 삽입
  await supabaseAdmin.from('code_uses').insert({
    code_id: codeRow.id,
    code: codeRow.code,
    used_by: userId,
    context,
    reward_granted: false,
    reward_data: rewards,
  });

  // 2. use_count 증가
  await supabaseAdmin
    .from('codes')
    .update({ use_count: (codeRow.use_count as number) + 1 })
    .eq('id', codeRow.id);

  // 3. 가입 코드 기록
  await supabaseAdmin
    .from('user_portfolios')
    .update({ invited_by_code: codeRow.code })
    .eq('user_id', userId);

  // 4. 리퍼럴 보상 지급
  if (codeRow.type === 'referral') {
    const referralRewards = rewards as { referee?: { type: string; amount: number }; referrer?: { type: string; amount: number } };

    // 피추천인 보상
    if (referralRewards.referee?.type === 'ai_credits') {
      await supabaseAdmin.from('user_credits').insert({
        user_id: userId,
        amount: referralRewards.referee.amount,
        source: 'referral',
        source_ref: codeRow.id,
      });
    }

    // 추천인 보상
    if (codeRow.created_by && referralRewards.referrer?.type === 'ai_credits') {
      await supabaseAdmin.from('user_credits').insert({
        user_id: codeRow.created_by,
        amount: referralRewards.referrer.amount,
        source: 'referral',
        source_ref: codeRow.id,
      });
    }
  }

  // 5. 보상 지급 완료 표시
  await supabaseAdmin
    .from('code_uses')
    .update({ reward_granted: true })
    .eq('code', codeRow.code)
    .eq('used_by', userId);
}

function getSuccessMessage(type: string, rewards: Record<string, unknown>): string {
  switch (type) {
    case 'invite':
      return '초대 코드가 확인됐어요! 솔비서 베타에 오신 걸 환영해요 🎉';
    case 'referral': {
      const r = rewards as { referee?: { amount: number } };
      const bonus = r.referee?.amount ?? 0;
      return bonus > 0
        ? `리퍼럴 코드 적용! AI 분석 ${bonus}회가 추가됐어요 🎁`
        : '리퍼럴 코드가 적용됐어요!';
    }
    case 'discount': {
      const d = rewards as { type?: string; amount?: number };
      return d.type === 'percent'
        ? `${d.amount}% 할인 코드가 적용됐어요!`
        : `${(d.amount ?? 0).toLocaleString()}원 할인 코드가 적용됐어요!`;
    }
    case 'promo':
      return '프로모션 코드가 적용됐어요!';
    default:
      return '코드가 적용됐어요!';
  }
}
